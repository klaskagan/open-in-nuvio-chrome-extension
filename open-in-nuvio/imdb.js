(() => {
  const movieTypes = new Set([
    'movie',
    'tvMovie',
    'short',
    'tvShort',
    'tvSpecial',
    'video',
  ]);
  const seriesTypes = new Set(['tvSeries', 'tvMiniSeries']);
  const parsed = new WeakMap();
  let host, shadow, routeId, timer, verifiedKind, lastParent;
  function idFrom(value) {
    try {
      const u = new URL(value, location.href);
      if (!['www.imdb.com', 'imdb.com', 'm.imdb.com'].includes(u.hostname)) return null;
      return u.pathname.match(/^\/title\/(tt\d{7,12})\/?$/)?.[1] || null;
    } catch {
      return null;
    }
  }
  // The manifest limits execution to IMDb; metadata URLs are checked separately.
  function currentId() {
    return location.pathname.match(/^\/title\/(tt\d{7,12})\/?$/)?.[1] || null;
  }
  function read(script) {
    if (!script) return null;
    const text = script.textContent;
    const old = parsed.get(script);
    if (old?.text === text) return old.value;
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      value = null;
    }
    parsed.set(script, { text, value });
    return value;
  }
  function kind(id) {
    const page = read(document.getElementById('__NEXT_DATA__'))?.props?.pageProps;
    const data = page?.aboveTheFoldData;
    if (data?.id === id && data.titleType?.id) {
      if (movieTypes.has(data.titleType.id)) return 'movie';
      if (seriesTypes.has(data.titleType.id)) return 'series';
      return false; // Episodes and games must never become guessed movies.
    }
    for (const script of document.querySelectorAll(
      'script[type="application/ld+json"]',
    )) {
      const value = read(script);
      const entries = Array.isArray(value)
        ? value
        : [value, ...(value?.['@graph'] || [])];
      for (const entry of entries) {
        if (!entry || idFrom(entry.url || entry['@id']) !== id) continue;
        const types = [].concat(entry['@type'] || []);
        if (types.includes('TVSeries') || types.includes('TVMiniSeries')) return 'series';
        if (types.includes('Movie')) return 'movie';
      }
    }
    return null;
  }
  function target() {
    const button = [
      ...document.querySelectorAll('[data-testid="tm-box-wl-button"]'),
    ].find((e) => !e.closest('[role="dialog"], [data-testid="MoreLikeThis"]'));
    return button && (button.closest('.ipc-split-button') || button);
  }
  function mount() {
    if (host) return;
    host = document.createElement('div');
    host.dataset.nuvioImdb = '';
    host.style.cssText =
      'all:initial;display:block;width:100%;min-width:0;box-sizing:border-box;margin:0 0 8px;';
    shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>
      :host{color-scheme:dark}*{box-sizing:border-box}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;font:600 14px/1.25 -apple-system,BlinkMacSystemFont,Arial,sans-serif}
      a{display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:10px 12px;text-decoration:none;border-radius:26px;border:1px solid #76528c;background:#241a2e;color:#dbb2f3;text-align:center;cursor:pointer}a:hover{background:#392348;border-color:#c592e4}.trakt{background:transparent;border-color:#6b6b6b;color:#ededed}.trakt:hover{background:#ffffff12;border-color:#dedede}a:focus-visible{outline:3px solid #f5c518;outline-offset:3px}svg,img{width:20px;height:20px;flex-shrink:0}img{object-fit:contain}@media(max-width:360px){a{padding:10px 7px;gap:5px;font-size:12px}}
      </style><div class="actions" aria-label="Open this title"><a class="nuvio" aria-label="Open in Nuvio"><img src="${globalThis.NuvioButtonIcon}" alt="" aria-hidden="true"><span>Open in Nuvio</span></a><a class="trakt" aria-label="Open in Trakt" target="_blank" rel="noopener noreferrer"><img src="${globalThis.TraktButtonIcon}" alt="" aria-hidden="true"><span>Open in Trakt</span></a></div>`;
    for (const link of shadow.querySelectorAll('a'))
      link.addEventListener('click', (e) => {
        const id = currentId();
        if (
          !id ||
          id !== routeId ||
          kind(id) === false ||
          (kind(id) || verifiedKind) !== host.dataset.kind
        ) {
          e.preventDefault();
          update();
        }
      });
  }
  function update() {
    timer = null;
    if (globalThis.NuvioSettings && !NuvioSettings.visible('imdb')) {
      host?.remove();
      return;
    }
    const id = currentId();
    if (id !== routeId) {
      host?.remove();
      verifiedKind = null;
      lastParent = null;
      routeId = id;
    }
    const detected = id && kind(id);
    if (detected === false) {
      host?.remove();
      verifiedKind = null;
      return;
    }
    const media = detected || verifiedKind;
    if (!media) {
      host?.remove();
      return;
    }
    const anchor = target();
    // Hydration temporarily removes metadata/watchlist controls on the same title.
    // Keep the already verified widget in its slot instead of unmounting it.
    if (!anchor?.parentElement) {
      if (!host?.isConnected && lastParent?.isConnected) lastParent.append(host);
      return;
    }
    verifiedKind = media;
    lastParent = anchor.parentElement;
    mount();
    routeId = id;
    host.dataset.kind = media;
    const nuvio = shadow.querySelector('.nuvio');
    const trakt = shadow.querySelector('.trakt');
    const n = `nuvio://imdb/${media}/${id}`;
    const t = `https://app.trakt.tv/${media === 'movie' ? 'movies' : 'shows'}/${id}`;
    if (nuvio.getAttribute('href') !== n) nuvio.href = n;
    if (trakt.getAttribute('href') !== t) trakt.href = t;
    nuvio.title = 'Open in Nuvio Desktop';
    trakt.title = 'Open in Trakt';
    if (host.parentElement !== anchor.parentElement || host.nextElementSibling !== anchor)
      anchor.before(host);
    globalThis.NuvioSettings?.apply('imdb', host, shadow);
  }
  globalThis.chrome?.runtime?.onMessage?.addListener((message, sender, reply) => {
    if (message?.type !== 'nuvio:current-link' || sender.id !== chrome.runtime.id) return;
    update();
    reply({
      url:
        globalThis.NuvioSettings?.visible('imdb') && host?.isConnected
          ? shadow.querySelector('.nuvio')?.getAttribute('href')
          : null,
    });
  });
  function schedule(records) {
    if (typeof location === 'undefined') return; // Document teardown may deliver final mutation records.
    if (
      records?.every((r) => r.target === host || r.target?.closest?.('[data-nuvio-imdb]'))
    )
      return;
    if (host && !host.isConnected) {
      clearTimeout(timer);
      update();
      return;
    }
    if (!timer) timer = setTimeout(update, 80);
  }
  new MutationObserver(schedule).observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-testid', 'href'],
  });
  window.addEventListener('popstate', update);
  window.addEventListener('pageshow', update);
  setInterval(() => {
    if (currentId() !== routeId || !host?.isConnected) update();
  }, 200);
  globalThis.NuvioSettings?.subscribe(update);
  update();
})();
