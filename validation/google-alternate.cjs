const fs = require('fs'),
  vm = require('vm'),
  assert = require('assert'),
  { JSDOM } = require('jsdom');
const root = __dirname + '/../open-in-nuvio/';
let n = 0;
const check = (v, m) => {
  assert(v, m);
  console.log('PASS ' + m);
  n++;
};
const delay = () => new Promise((r) => setTimeout(r, 180));
(async () => {
  const html =
    '<div data-attrid="title">Ponas ir ponia Smitai</div><div data-attrid="subtitle">2005 m. ‧ Veiksmo/Komedija</div><div data-attrid="VisualDigestWebResult">Telia Play Ponas ir ponia Smitai (Mr. & Mrs. Smith) - Telia Play</div><div data-attrid="kc:/film/film:media_actions_wholepage"><button>Žiūrėta</button><button>Noriu žiūrėti</button></div>';
  let calls = [];
  const d = new JSDOM(html, {
      url: 'https://www.google.com/search?q=Ponas+ir+ponia+Smitai',
      runScripts: 'outside-only',
    }),
    w = d.window;
  const orig = w.Element.prototype.attachShadow;
  let shadow;
  w.Element.prototype.attachShadow = function (o) {
    const s = orig.call(this, o);
    shadow = s;
    return s;
  };
  w.chrome = {
    runtime: {
      sendMessage: async (m) => {
        calls.push(m);
        return { identity: { provider: 'imdb', id: 'tt0356910' } };
      },
    },
  };
  for (const f of ['settings.js', 'button-icon.js', 'google-core.js', 'google.js'])
    w.eval(fs.readFileSync(root + f, 'utf8'));
  await delay();
  check(
    calls.length === 1 &&
      calls[0].year === 2005 &&
      calls[0].titles.includes('Mr. & Mrs. Smith'),
    'Missing ratings uses panel original-title alias and exact year',
  );
  check(
    shadow.querySelector('.nuvio').href === 'nuvio://imdb/movie/tt0356910',
    'Alternate layout mounts exact movie buttons',
  );
  check(
    d.window.document
      .querySelector('[data-nuvio-google]')
      .parentElement.matches('[data-attrid$=media_actions_wholepage]'),
    'Buttons attach to the alternate watch section',
  );
  w.history.pushState({}, '', '/search?q=another');
  w.dispatchEvent(new w.PopStateEvent('popstate'));
  await delay();
  check(
    !w.document.querySelector('[data-nuvio-google]'),
    'Old panel is blocked during query navigation',
  );
  d.window.close();
  for (const sample of [
    {
      title: 'Pirmoji nuodėmė',
      year: 2001,
      alias: 'Original Sin',
      extra:
        '<div data-attrid="description"><span>Original Sin is a 2001 American erotic romantic thriller film written and directed by Michael Cristofer.</span></div>',
    },
    {
      title: 'Kapų plėšikė Lara Kroft',
      year: 2001,
      alias: 'Lara Croft: Tomb Raider',
      extra:
        '<section><a href="https://lt.wikipedia.org/wiki/Film"><h3>Kapų plėšikė Lara Kroft</h3></a><p>Kapų plėšikė Lara Kroft (angl. Lara Croft: Tomb Raider) – 2001 m. filmas.</p></section>',
    },
    {
      title: 'Ponas ir ponia Smitai',
      year: 2005,
      alias: 'Mr. & Mrs. Smith',
      extra:
        '<section><a href="https://lt.wikipedia.org/wiki/Film"><h3>Ponas ir ponia Smitai</h3></a><p>Ponas ir ponia Smitai (angl. Mr. &amp; Mrs. Smith) – 2005 m. filmas.</p></section>',
    },
  ]) {
    const doc = new JSDOM(
      '<div data-attrid="title">' +
        sample.title +
        '</div><div data-attrid="subtitle">' +
        sample.year +
        ' m.</div><div data-attrid="kc:/film/film:media_actions_wholepage"></div>' +
        sample.extra,
      { url: 'https://www.google.com/search?q=film&hl=lt', runScripts: 'outside-only' },
    );
    let metadata;
    doc.window.chrome = {
      runtime: {
        sendMessage: async (m) => {
          metadata = m;
          return { identity: { provider: 'imdb', id: 'tt0356910' } };
        },
      },
    };
    for (const f of ['settings.js', 'button-icon.js', 'google-core.js', 'google.js'])
      doc.window.eval(fs.readFileSync(root + f, 'utf8'));
    await delay();
    check(
      metadata?.titles.includes(sample.alias),
      'Real-layout alias recognized: ' + sample.title,
    );
    check(
      doc.window.document.querySelector('[data-nuvio-google]'),
      'Carousel controls mount for ' + sample.title,
    );
    doc.window.close();
  }
  const organic = new JSDOM(
    html +
      '<a href="https://www.imdb.com/title/tt0356910/"><h3>Mr. &amp; Mrs. Smith (2005)</h3></a><a href="https://www.imdb.com/title/tt14044212/"><h3>Mr. &amp; Mrs. Smith (2024)</h3></a>',
    { url: 'https://www.google.com/search?q=smith', runScripts: 'outside-only' },
  );
  let net = 0;
  organic.window.chrome = {
    runtime: {
      sendMessage: async () => {
        net++;
        return {};
      },
    },
  };
  let ui;
  organic.window.Element.prototype.attachShadow = function (o) {
    ui = orig.call(this, o);
    return ui;
  };
  for (const f of ['settings.js', 'button-icon.js', 'google-core.js', 'google.js'])
    organic.window.eval(fs.readFileSync(root + f, 'utf8'));
  await delay();
  check(
    net === 0 && ui.querySelector('.imdb').href.endsWith('/tt0356910/'),
    'Exact organic title and year works locally and rejects remake year',
  );
  organic.window.close();
  let listener,
    mode = 'exact',
    seen = [];
  const c = {
    runtime: {
      id: 'x',
      getURL: (f) => 'chrome-extension://x/' + f,
      onMessage: { addListener: (f) => (listener = f) },
    },
    storage: {
      local: {
        get: async () => ({
          nuvioTrakt: {
            clientId: 'x',
            tokens: {
              access_token: 'fake',
              refresh_token: 'fake',
              created_at: Date.now() / 1000,
              expires_in: 3600,
            },
          },
        }),
      },
    },
  };
  const ctx = vm.createContext({
    chrome: c,
    URL,
    URLSearchParams,
    Map,
    Set,
    Date,
    Promise,
    AbortSignal,
    NuvioSettings: {
      ready: Promise.resolve(),
      get: () => ({ enabled: true, traktControls: true, sites: { google: true } }),
    },
    NuvioGoogle: { googleHost: (h) => h === 'www.google.com' },
    fetch: async (url) => {
      seen.push(url);
      const u = new URL(url);
      if (url.includes('/translations'))
        return {
          ok: true,
          json: async () => [
            {
              title:
                mode === 'wrong-translation' ? 'Kitas filmas' : 'Ponas ir ponia Smitai',
            },
          ],
          headers: { get: () => '1' },
        };
      const item = {
        title: 'Mr. & Mrs. Smith',
        year: mode === 'year' ? 2024 : 2005,
        ids: { imdb: 'tt0356910', trakt: 20 },
      };
      return {
        ok: true,
        json: async () =>
          mode === 'later' && !u.searchParams.has('page')
            ? []
            : mode === 'ambiguous'
              ? [
                  { type: 'movie', movie: item },
                  { type: 'movie', movie: { ...item, ids: { imdb: 'tt9999999' } } },
                ]
              : [{ type: 'movie', movie: item }],
        headers: {
          get: () =>
            mode === 'broad' ||
            (mode === 'broad-local' && u.searchParams.get('query').startsWith('Ponas'))
              ? '6'
              : ['pages', 'later'].includes(mode)
                ? '2'
                : '1',
        },
      };
    },
  });
  vm.runInContext(fs.readFileSync(root + 'trakt-api.js', 'utf8'), ctx);
  const send = (extra) =>
    new Promise((r) =>
      listener(
        {
          type: 'nuvio:trakt-identify',
          kind: 'movie',
          year: 2005,
          titles: ['Ponas ir ponia Smitai', 'Mr. & Mrs. Smith'],
          ...extra,
        },
        { id: 'x', url: 'https://www.google.com/search?q=smith', frameId: 0 },
        r,
      ),
    );
  let r = await send();
  check(
    r.identity?.id === 'tt0356910',
    'API fallback accepts unique exact original title/year/type',
  );
  check(
    seen.every(
      (s) =>
        s.startsWith('https://api.trakt.tv/search/movie?') &&
        new URL(s).searchParams.get('years') === '2005',
    ),
    'Fallback API requests constrained to movie search and year',
  );
  mode = 'year';
  check((await send()).error, 'Wrong-year API match rejected');
  mode = 'ambiguous';
  check((await send()).error, 'Multiple exact IDs rejected');
  mode = 'translation';
  check(
    (await send({ titles: ['Ponas ir ponia Smitai'] })).identity?.id === 'tt0356910',
    'Exact Trakt translation accepts localized-only panel',
  );
  mode = 'wrong-translation';
  check(
    (await send({ titles: ['Ponas ir ponia Smitai'] })).error,
    'Mismatched translation rejected',
  );
  mode = 'pages';
  check(
    (await send()).identity?.id === 'tt0356910',
    'Complete paginated matches resolve and deduplicate IDs',
  );
  mode = 'later';
  check(
    (await send()).identity?.id === 'tt0356910',
    'Exact result on second page resolves',
  );
  mode = 'broad-local';
  check(
    (await send()).identity?.id === 'tt0356910',
    'Broad localized alias does not block complete original-title search',
  );
  mode = 'broad';
  check(
    (await send()).error?.includes('too broad'),
    'Excessively broad search fails with accurate explanation',
  );
  check((await send({ titles: [''] })).error, 'Invalid metadata rejected before request');
  console.log('TOTAL ' + n + ' alternate Google layout checks passed');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
