/* OAuth tokens stay in the extension worker and trusted extension pages. */
(() => {
  const API = 'https://api.trakt.tv',
    AUTH = 'https://auth.trakt.tv';
  let refreshTask;
  const busy = new Set();
  const titles = new Map(),
    states = new Map(),
    inflight = new Map(),
    receipts = new Map();
  let generation = 0;
  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area === 'local' && changes.nuvioTrakt) {
      receipts.clear();
      seriesPlans.clear();
      generation++;
      states.clear();
      inflight.clear();
    }
  });
  const store = chrome.storage?.local;
  const own = (url) => {
    try {
      const u = new URL(url),
        base = new URL(chrome.runtime.getURL('trakt.html'));
      return (
        u.protocol === base.protocol &&
        u.host === base.host &&
        u.pathname === base.pathname
      );
    } catch {
      return false;
    }
  };
  const b64 = (bytes) =>
    btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
  async function account() {
    return (await store.get('nuvioTrakt')).nuvioTrakt || {};
  }
  async function tokenRequest(body) {
    const r = await fetch(API + '/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'omit',
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw Error('Trakt authorization failed. Reconnect your account.');
    const t = await r.json();
    if (!t.access_token || !t.refresh_token)
      throw Error('Invalid authorization response');
    return t;
  }
  async function access() {
    let a = await account();
    if (!a.tokens) throw Error('Connect Trakt in settings first.');
    if ((a.tokens.created_at + a.tokens.expires_in) * 1000 < Date.now() + 60000) {
      if (!refreshTask)
        refreshTask = (async () => {
          const next = await tokenRequest({
            grant_type: 'refresh_token',
            refresh_token: a.tokens.refresh_token,
            client_id: a.clientId,
            redirect_uri: chrome.identity.getRedirectURL('trakt'),
          });
          const latest = await account();
          if (latest.tokens?.refresh_token !== a.tokens.refresh_token)
            throw Error('Connection changed. Retry.');
          a = { ...a, tokens: next };
          await store.set({ nuvioTrakt: a });
          return a;
        })().finally(() => (refreshTask = null));
      a = await refreshTask;
    }
    return a;
  }
  async function request(path, body) {
    const a = await access();
    const r = await fetch(API + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-key': a.clientId,
        'trakt-api-version': '2',
        Authorization: 'Bearer ' + a.tokens.access_token,
      },
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!r.ok)
      throw Error(
        r.status === 401
          ? 'Trakt connection expired. Reconnect in settings.'
          : r.status === 429
            ? 'Trakt rate limit reached. Try again later.'
            : 'Trakt request failed (' + r.status + '). Please retry.',
      );
    return {
      data: await r.json(),
      pages: Number(r.headers.get('X-Pagination-Page-Count') || 1),
      count: Number(r.headers.get('X-Pagination-Item-Count') || 0),
    };
  }
  async function lookup(id, kind) {
    if (!/^tt\d{7,12}$/.test(id) || !['movie', 'series'].includes(kind))
      throw Error('Invalid title');
    const key = kind + ':' + id,
      old = titles.get(key);
    if (old && old.expires > Date.now()) return old.value;
    const type = kind === 'movie' ? 'movie' : 'show';
    const { data } = await request('/search/imdb/' + id + '?type=' + type);
    const found = data.filter((x) => x.type === type && x[type]?.ids?.imdb === id);
    if (found.length !== 1 || !Number.isSafeInteger(found[0][type].ids.trakt))
      throw Error('No unambiguous Trakt title found.');
    titles.set(key, { value: found[0][type], expires: Date.now() + 1800000 });
    if (titles.size > 100) titles.delete(titles.keys().next().value);
    return found[0][type];
  }
  async function listed(item, kind) {
    const type = kind === 'movie' ? 'movies' : 'shows';
    for (let p = 1; p <= 200; p++) {
      const r = await request('/sync/watchlist/' + type + '?page=' + p + '&limit=100');
      if (r.data.some((x) => (x.movie || x.show)?.ids?.trakt === item.ids.trakt))
        return true;
      if (p >= r.pages) return false;
    }
    throw Error('Watchlist too large to read completely.');
  }
  async function state(id, kind, fresh = false) {
    if (!/^tt\d{7,12}$/.test(id || '') || !['movie', 'series'].includes(kind))
      throw Error('Invalid title');
    await access();
    const key = kind + ':' + id,
      epoch = generation,
      old = states.get(key);
    if (!fresh && old && old.expires > Date.now()) return { ...old.value };
    if (!fresh && inflight.has(key)) return inflight.get(key);
    const task = (async () => {
      const item = await lookup(id, kind);
      const [watchlist, h] = await Promise.all([
        listed(item, kind),
        kind === 'movie'
          ? request('/sync/history/movies/' + item.ids.trakt + '?page=1&limit=1')
          : seriesProgress(item),
      ]);
      const value =
        kind === 'series'
          ? {
              title: item.title,
              watchlist,
              series: true,
              watched: h.aired > 0 && h.completed >= h.aired,
              completed: h.completed,
              episodes: h.aired,
            }
          : {
              title: item.title,
              watchlist,
              watched: h.data.length > 0,
              plays: h.count || h.data.length,
            };
      const receipt = receipts.get(key);
      if (receipt && receipt.expires > Date.now()) Object.assign(value, receipt.patch);
      else receipts.delete(key);
      if (value.watched && value.plays === 0) value.plays = 1;
      if (epoch !== generation) return state(id, kind, true);
      if (epoch === generation) {
        states.set(key, { value, expires: Date.now() + 10000 });
        if (states.size > 100) states.delete(states.keys().next().value);
      }
      return value;
    })();
    inflight.set(key, task);
    try {
      return await task;
    } finally {
      if (inflight.get(key) === task) inflight.delete(key);
    }
  }
  async function publish(id, kind, value) {
    if (!chrome.tabs?.query) return;
    try {
      const tabs = await chrome.tabs.query({
        url: [
          'https://*.google.com/search*',
          'https://*.google.lt/search*',
          'https://*.google.co.uk/search*',
        ],
      });
      await Promise.allSettled(
        tabs.map((t) =>
          chrome.tabs.sendMessage(t.id, {
            type: 'nuvio:trakt-state-changed',
            id,
            kind,
            state: value,
          }),
        ),
      );
    } catch {}
  }
  const seriesPlans = new Map();
  async function seriesProgress(item) {
    return (
      await request(
        '/shows/' +
          item.ids.trakt +
          '/progress/watched?hidden=false&specials=false&count_specials=false',
      )
    ).data;
  }
  function airedEpisodes(progress) {
    return (progress.seasons || [])
      .filter((s) => s.number > 0)
      .flatMap((s) =>
        (s.episodes || [])
          .filter((e) => e.number > 0)
          .map((e) => ({
            season: s.number,
            number: e.number,
            completed: Boolean(e.completed),
          })),
      );
  }
  async function seriesPlan(id, desired) {
    if (typeof desired !== 'boolean') throw Error('Invalid action');
    const item = await lookup(id, 'series'),
      progress = await seriesProgress(item),
      all = airedEpisodes(progress);
    if (!all.length || all.length > 10000 || all.length !== progress.aired)
      throw Error('Could not verify all aired episodes. Please try again.');
    const episodes = desired ? all.filter((e) => !e.completed) : all;
    const token = random();
    seriesPlans.set(token, { id, desired, episodes, expires: Date.now() + 120000 });
    if (seriesPlans.size > 100) seriesPlans.delete(seriesPlans.keys().next().value);
    return { title: item.title, count: episodes.length, total: all.length, token };
  }
  async function mutate(m) {
    const key = m.id + ':' + m.kind;
    if (busy.has(key)) throw Error('An update is already in progress.');
    busy.add(key);
    generation++;
    states.clear();
    inflight.clear();
    try {
      const item = await lookup(m.id, m.kind);
      const type = m.kind === 'movie' ? 'movies' : 'shows';
      const recent = receipts.get(m.kind + ':' + m.id),
        last = recent?.expires > Date.now() ? recent.patch : {};
      let path, body;
      if (m.action === 'watchlist') {
        if (typeof m.desired !== 'boolean') throw Error('Invalid action');
        const existing = await listed(item, m.kind);
        if (
          existing === m.desired &&
          (last.watchlist === undefined || last.watchlist === m.desired)
        )
          return state(m.id, m.kind, true);
        path = '/sync/watchlist' + (m.desired ? '' : '/remove');
        body = { [type]: [{ ids: { trakt: item.ids.trakt } }] };
      } else if (m.action === 'watched' && m.kind === 'movie') {
        const h = await request(
          '/sync/history/movies/' + item.ids.trakt + '?page=1&limit=1',
        );
        const has = h.data.length > 0;
        if (typeof m.desired !== 'boolean') throw Error('Invalid action');
        if (
          has === m.desired &&
          (last.watched === undefined || last.watched === m.desired)
        )
          return state(m.id, m.kind, true);
        path = '/sync/history' + (m.desired ? '' : '/remove');
        body = {
          movies: [
            {
              ids: { trakt: item.ids.trakt },
              ...(m.desired ? { watched_at: new Date().toISOString() } : {}),
            },
          ],
        };
      } else if (m.action === 'watched' && m.kind === 'series') {
        const plan = seriesPlans.get(m.planToken);
        seriesPlans.delete(m.planToken);
        if (
          !plan ||
          plan.id !== m.id ||
          plan.desired !== m.desired ||
          plan.expires < Date.now()
        )
          throw Error('Please confirm the series update again.');
        if (!plan.episodes.length) return state(m.id, m.kind, true);
        const seasons = new Map();
        for (const e of plan.episodes) {
          if (!seasons.has(e.season)) seasons.set(e.season, []);
          seasons.get(e.season).push({ number: e.number });
        }
        path = '/sync/history' + (m.desired ? '' : '/remove');
        body = {
          shows: [
            {
              ids: { trakt: item.ids.trakt },
              seasons: [...seasons].map(([number, episodes]) => ({ number, episodes })),
              ...(m.desired ? { watched_at: new Date().toISOString() } : {}),
            },
          ],
        };
      } else if (m.action === 'episode' && m.kind === 'series') {
        if (
          !Number.isInteger(m.season) ||
          m.season < 0 ||
          !Number.isInteger(m.episode) ||
          m.episode < 1 ||
          typeof m.desired !== 'boolean'
        )
          throw Error('Invalid episode');
        const e = (
          await request(
            '/shows/' +
              item.ids.trakt +
              '/seasons/' +
              m.season +
              '/episodes/' +
              m.episode,
          )
        ).data;
        if (!Number.isSafeInteger(e.ids?.trakt)) throw Error('Episode not found');
        const h = await request(
          '/sync/history/episodes/' + e.ids.trakt + '?page=1&limit=1',
        );
        if (Boolean(h.data.length) === m.desired) return { ok: true };
        if (!m.desired && !m.confirmRemove)
          throw Error('Confirm removal of episode viewings.');
        path = '/sync/history' + (m.desired ? '' : '/remove');
        body = {
          episodes: [
            {
              ids: { trakt: e.ids.trakt },
              ...(m.desired ? { watched_at: new Date().toISOString() } : {}),
            },
          ],
        };
      } else throw Error('Unsupported update');
      if (!NuvioSettings.get().enabled || !NuvioSettings.get().traktControls)
        throw Error('Trakt controls were disabled.');
      const result = (await request(path, body)).data;
      if (Object.values(result.not_found || {}).some((x) => x?.length))
        throw Error('Trakt could not match this item.');
      if (m.action === 'episode') return { ok: true };
      const receiptKey = m.kind + ':' + m.id,
        prior = receipts.get(receiptKey);
      const patch = {
        ...(prior?.expires > Date.now() ? prior.patch : {}),
        [m.action]: m.desired,
      };
      if (m.action === 'watched') {
        if (m.desired) {
          delete patch.plays;
          patch.watchlist = false;
        } else patch.plays = 0;
      }
      receipts.set(receiptKey, { patch, expires: Date.now() + 60000 });
      if (receipts.size > 100) receipts.delete(receipts.keys().next().value);
      generation++;
      states.clear();
      inflight.clear();
      let updated;
      try {
        updated = await state(m.id, m.kind, true);
      } catch {
        updated = { title: item.title, ...patch };
      }
      await publish(m.id, m.kind, updated);
      return updated;
    } finally {
      busy.delete(key);
    }
  }
  async function connect(clientId) {
    clientId = globalThis.NuvioTraktConfig?.clientId || clientId;
    if (!/^[a-zA-Z0-9_-]{16,128}$/.test(clientId || ''))
      throw Error('Enter your Trakt API Client ID.');
    const verifier = random(),
      state = random(),
      redirect = chrome.identity.getRedirectURL('trakt');
    const challenge = b64(
      new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
      ),
    );
    const url = new URL(AUTH + '/oauth/authorize');
    Object.entries({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: 'code',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).forEach(([k, v]) => url.searchParams.set(k, v));
    const result = await chrome.identity.launchWebAuthFlow({
      url: url.href,
      interactive: true,
    });
    const callback = new URL(result);
    if (
      callback.origin + callback.pathname !== redirect ||
      callback.searchParams.get('state') !== state ||
      !callback.searchParams.get('code')
    )
      throw Error('Authorization was canceled or could not be validated.');
    const tokens = await tokenRequest({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirect,
      code: callback.searchParams.get('code'),
      code_verifier: verifier,
    });
    await store.set({ nuvioTrakt: { clientId, tokens } });
    receipts.clear();
    seriesPlans.clear();
    generation++;
    states.clear();
    inflight.clear();
    return { connected: true };
  }
  chrome.runtime.onMessage.addListener((m, s, reply) => {
    if (!m?.type?.startsWith('nuvio:trakt-')) return;
    const trusted = s.id === chrome.runtime.id && own(s.url);
    let google = false;
    try {
      const u = new URL(s.url);
      google =
        s.id === chrome.runtime.id &&
        u.protocol === 'https:' &&
        u.pathname === '/search' &&
        NuvioGoogle.googleHost(u.hostname) &&
        s.frameId === 0;
    } catch {}
    if (!trusted && !google) return;
    (async () => {
      if (m.type === 'nuvio:trakt-account' && trusted) {
        const a = await account();
        return {
          connected: Boolean(a.tokens),
          clientId: a.clientId || globalThis.NuvioTraktConfig?.clientId || '',
          sharedApp: Boolean(globalThis.NuvioTraktConfig?.clientId),
          redirect: chrome.identity.getRedirectURL('trakt'),
        };
      }
      if (m.type === 'nuvio:trakt-connect' && trusted) return connect(m.clientId);
      if (m.type === 'nuvio:trakt-disconnect' && trusted) {
        await store.remove('nuvioTrakt');
        receipts.clear();
        seriesPlans.clear();
        generation++;
        states.clear();
        inflight.clear();
        return { connected: false };
      }
      await NuvioSettings.ready;
      const prefs = NuvioSettings.get();
      if (!prefs.enabled || !prefs.traktControls || (!trusted && !prefs.sites.google))
        throw Error('Trakt controls are disabled in settings.');
      if (m.type === 'nuvio:trakt-manage' && google) {
        if (!/^tt\d{7,12}$/.test(m.id || '') || !['movie', 'series'].includes(m.kind))
          throw Error('Invalid title');
        await chrome.tabs.create({
          url:
            chrome.runtime.getURL('trakt.html') +
            '?' +
            new URLSearchParams({ id: m.id, kind: m.kind }),
        });
        return { ok: true };
      }
      if (m.type === 'nuvio:trakt-identify' && google) {
        if (
          !Number.isInteger(m.year) ||
          m.year < 1880 ||
          m.year > 2100 ||
          !['movie', 'series'].includes(m.kind) ||
          !Array.isArray(m.titles) ||
          m.titles.length < 1 ||
          m.titles.length > 4 ||
          m.titles.some(
            (t) =>
              typeof t !== 'string' ||
              t.length < 2 ||
              t.length > 200 ||
              !/[\p{L}\p{N}]/u.test(t),
          ) ||
          (m.directors !== undefined &&
            (!Array.isArray(m.directors) ||
              m.directors.length > 5 ||
              m.directors.some((d) => typeof d !== 'string' || d.length > 150)))
        )
          throw Error('Invalid panel metadata');
        const normalize = (t) =>
          t
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/&/g, 'and')
            .replace(/[^\p{L}\p{N}]/gu, '');
        const type = m.kind === 'movie' ? 'movie' : 'show',
          matches = new Map(),
          candidates = new Map();
        // A broad localized alias must not prevent a complete original-title lookup.
        let incomplete = false,
          completeCanonical = false;
        for (const title of m.titles) {
          const query = title.replace(/[^\p{L}\p{N}\s]/gu, ' ');
          const params = new URLSearchParams({
            query,
            years: m.directors?.length ? `${m.year - 1}-${m.year + 1}` : String(m.year),
            fields: 'title,original_title,translations,aliases',
            limit: '100',
          });
          const path = '/search/' + type + '?';
          const first = await request(path + params);
          if (first.pages > 5) {
            incomplete = true;
            continue;
          }
          const rows = [...first.data];
          for (let page = 2; page <= first.pages; page++) {
            params.set('page', String(page));
            const next = await request(path + params);
            if (next.pages > 5)
              throw Error('Title search is too broad. Try a result with an IMDb rating.');
            rows.push(...next.data);
          }
          for (const row of rows) {
            const item = row[type];
            if (
              row.type === type &&
              (item?.year === m.year ||
                (m.directors?.length &&
                  Number.isInteger(item?.year) &&
                  Math.abs(item.year - m.year) === 1)) &&
              /^tt\d{7,12}$/.test(item.ids?.imdb || '')
            ) {
              candidates.set(item.ids.imdb, item);
              if (normalize(title) === normalize(item.title)) completeCanonical = true;
            }
          }
        }
        if (incomplete && !completeCanonical)
          throw Error('Title search is too broad. Try a result with an IMDb rating.');
        const canonical = [...candidates].filter(([id, item]) =>
          m.titles.some((t) => normalize(t) === normalize(item.title)),
        );
        const pool = canonical.length ? canonical : [...candidates];
        if (pool.length > 10) throw Error('Too many candidate titles');
        for (const [id, item] of pool) {
          let exact = m.titles.some((t) => normalize(t) === normalize(item.title));
          if (!exact && Number.isSafeInteger(item.ids.trakt)) {
            const translations = (
              await request(
                '/' +
                  (type === 'movie' ? 'movies' : 'shows') +
                  '/' +
                  item.ids.trakt +
                  '/translations',
              )
            ).data;
            exact = translations.some(
              (x) =>
                typeof x.title === 'string' &&
                m.titles.some((t) => normalize(t) === normalize(x.title)),
            );
          }
          if (exact && item.year !== m.year) {
            if (!m.directors?.length || !Number.isSafeInteger(item.ids.trakt)) continue;
            const people = (
              await request(
                '/' +
                  (type === 'movie' ? 'movies' : 'shows') +
                  '/' +
                  item.ids.trakt +
                  '/people',
              )
            ).data;
            const directors = (people.crew?.directing || [])
              .filter((x) => x.job === 'Director')
              .map((x) => x.person?.name)
              .filter(Boolean);
            exact = directors.some((d) =>
              m.directors.some((name) => normalize(name) === normalize(d)),
            );
          }
          if (exact) matches.set(id, item);
        }
        if (matches.size !== 1)
          throw Error(
            matches.size > 1
              ? 'Multiple exact title matches.'
              : 'No exact title and year match.',
          );
        return { identity: { provider: 'imdb', id: [...matches.keys()][0] } };
      }
      if (m.type === 'nuvio:trakt-series-plan') return seriesPlan(m.id, m.desired);
      if (m.type === 'nuvio:trakt-state') return state(m.id, m.kind, trusted);
      if (m.type === 'nuvio:trakt-update') {
        if (!trusted && (m.action === 'episode' || m.confirmRemove))
          throw Error('Use the Trakt management page for history removal and episodes.');
        return mutate(m);
      }
      if (m.type === 'nuvio:trakt-episodes' && trusted) {
        const item = await lookup(m.id, 'series');
        if (m.season === undefined)
          return {
            seasons: (await request('/shows/' + item.ids.trakt + '/seasons')).data.map(
              (s) => ({ number: s.number, episodes: s.episode_count }),
            ),
          };
        if (!Number.isInteger(m.season) || m.season < 0) throw Error('Invalid season');
        const episodes = (
          await request('/shows/' + item.ids.trakt + '/seasons/' + m.season)
        ).data;
        const progress = (
          await request('/shows/' + item.ids.trakt + '/progress/watched?specials=true')
        ).data;
        return {
          episodes: episodes.map((e) => ({
            number: e.number,
            title: e.title,
            watched: Boolean(
              progress.seasons
                ?.find((s) => s.number === m.season)
                ?.episodes?.find((x) => x.number === e.number)?.completed,
            ),
          })),
        };
      }
      throw Error('Unsupported request');
    })()
      .then(reply)
      .catch((e) => reply({ error: e.message || 'Trakt request failed' }));
    return true;
  });
})();
