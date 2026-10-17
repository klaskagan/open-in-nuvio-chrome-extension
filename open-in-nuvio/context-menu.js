(() => {
  const jobs = new Map();
  const traktPatterns = ['trakt.tv', 'www.trakt.tv', 'app.trakt.tv'].flatMap((h) =>
    ['movies', 'shows'].map((k) => `https://${h}/${k}/*`),
  );
  const otherPatterns = ['imdb.com', 'www.imdb.com', 'm.imdb.com']
    .map((h) => `https://${h}/title/tt*`)
    .concat(
      [
        'google.com',
        'www.google.com',
        'google.lt',
        'www.google.lt',
        'google.co.uk',
        'www.google.co.uk',
      ].flatMap((h) => [`https://${h}/goto*`, `https://${h}/url*`]),
    );
  let menuRevision = 0;
  function enabled() {
    const s = globalThis.NuvioSettings;
    return !s || (s.loaded && s.get().enabled && s.get().contextMenu);
  }
  function install() {
    if (globalThis.NuvioSettings && !NuvioSettings.loaded) {
      NuvioSettings.ready.then(install);
      return;
    }
    const revision = ++menuRevision;
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError || revision !== menuRevision || !enabled()) return;
      const add = (options) =>
        chrome.contextMenus.create(options, () => {
          void chrome.runtime.lastError;
        });
      add({
        id: 'nuvio-open',
        title: 'Open in Nuvio',
        contexts: ['link'],
        targetUrlPatterns: [...traktPatterns, ...otherPatterns],
      });
      add({
        id: 'nuvio-trakt',
        parentId: 'nuvio-open',
        title: 'Open Trakt title',
        contexts: ['link'],
        targetUrlPatterns: traktPatterns,
      });
      add({
        id: 'nuvio-movie',
        parentId: 'nuvio-open',
        title: 'Movie',
        contexts: ['link'],
        targetUrlPatterns: otherPatterns,
      });
      add({
        id: 'nuvio-series',
        parentId: 'nuvio-open',
        title: 'TV series / miniseries',
        contexts: ['link'],
        targetUrlPatterns: otherPatterns,
      });
    });
  }
  async function cleanup(tabId, job) {
    try {
      const tab = await chrome.tabs.get(tabId);
      const s = NuvioLinks.source(tab.url);
      if (
        !tab.active &&
        s?.provider === 'trakt' &&
        (s.key === job.source.key || s.key === job.acceptedKey)
      )
        await chrome.tabs.remove(tabId);
    } catch {}
  }
  async function resolveTrakt(source) {
    const tab = await chrome.tabs.create({ url: source.url, active: false });
    return new Promise((resolve) => {
      const job = { source, resolve, timer: null, acceptedKey: null };
      jobs.set(tab.id, job);
      job.timer = setTimeout(() => {
        if (jobs.get(tab.id) !== job) return;
        jobs.delete(tab.id);
        cleanup(tab.id, job);
        resolve({
          error:
            'Trakt did not provide an exact ID in time. You can retry or open the title on Trakt.',
        });
      }, 18000);
      // Also ask explicitly: a cached title may already have rendered before registration.
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { type: 'nuvio:report-title' }).catch(() => {});
      }, 700);
    });
  }
  async function resolve(source, kind) {
    if (source.provider === 'trakt') return resolveTrakt(source);
    let data = source;
    if (source.provider === 'google')
      data = await resolveGoogle(source.host, source.token);
    const url = NuvioLinks.deepLink(data, kind);
    return url
      ? { url, kind, identity: data.id }
      : {
          error:
            'This link did not resolve to a supported IMDb title. No title was guessed.',
        };
  }
  if (chrome.contextMenus) {
    chrome.runtime.onInstalled?.addListener(install);
    chrome.runtime.onStartup?.addListener(install);
    globalThis.NuvioSettings?.subscribe(install);
    if (globalThis.NuvioSettings) NuvioSettings.ready.then(install);
    chrome.contextMenus.onClicked.addListener(async (info) => {
      await globalThis.NuvioSettings?.ready;
      if (!enabled()) return;
      if (!['nuvio-trakt', 'nuvio-movie', 'nuvio-series'].includes(info.menuItemId))
        return;
      const s = NuvioLinks.source(info.linkUrl);
      if (!s) return;
      const kind =
        info.menuItemId === 'nuvio-movie'
          ? 'movie'
          : info.menuItemId === 'nuvio-series'
            ? 'series'
            : s.kind;
      if (!['movie', 'series'].includes(kind)) return;
      const fragment = new URLSearchParams({ source: s.url, kind });
      chrome.tabs
        .create({ url: chrome.runtime.getURL('launch.html') + '#' + fragment.toString() })
        .catch(() => {});
    });
  }
  chrome.tabs?.onRemoved?.addListener((tabId) => {
    const job = jobs.get(tabId);
    if (!job) return;
    jobs.delete(tabId);
    clearTimeout(job.timer);
    job.resolve({
      error: 'The temporary lookup tab was closed before Trakt provided the title ID.',
    });
  });
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type === 'nuvio:trakt-ready') {
      const job = jobs.get(sender.tab?.id);
      if (!job || sender.id !== chrome.runtime.id) return;
      const page = NuvioLinks.source(sender.url);
      if (page?.provider !== 'trakt' || page.kind !== job.source.kind) return;
      const alias = job.source.key.split('/')[1];
      if (
        message.key !== job.source.key &&
        (!/^tt\d{7,12}$/.test(alias) || message.imdb !== alias)
      )
        return;
      const imdb = { provider: 'imdb', id: message.imdb };
      const tmdb = { provider: 'tmdb', id: message.tmdb };
      const url =
        NuvioLinks.deepLink(tmdb, job.source.kind) ||
        NuvioLinks.deepLink(imdb, job.source.kind);
      if (!url) return;
      jobs.delete(sender.tab.id);
      clearTimeout(job.timer);
      job.acceptedKey = page.key;
      cleanup(sender.tab.id, job);
      job.resolve({
        url,
        kind: job.source.kind,
        identity: String(message.tmdb || message.imdb),
      });
      respond({ ok: true });
      return;
    }
    if (message?.type !== 'nuvio:resolve-link') return;
    if (
      sender.id !== chrome.runtime.id ||
      sender.url?.split('#')[0] !== chrome.runtime.getURL('launch.html')
    )
      return;
    const s = NuvioLinks.source(message.source);
    if (!s || !['movie', 'series'].includes(message.kind)) return;
    Promise.resolve(globalThis.NuvioSettings?.ready)
      .then(() =>
        enabled()
          ? resolve(s, s.kind || message.kind)
          : { error: 'Right-click shortcuts are paused. Enable them in Nuvio settings.' },
      )
      .then(respond)
      .catch(() => respond({ error: 'The title could not be resolved. Please retry.' }));
    return true;
  });
})();
