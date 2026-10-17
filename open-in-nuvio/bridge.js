// MAIN world: observe Trakt summaries and read the current title's existing cache.
// No network requests, auth access, cache writes, or account data forwarding.
(() => {
  const seen = new Map();
  const hosts = new Set(['api.trakt.tv', 'apiz.trakt.tv', 'app.trakt.tv', 'trakt.tv', 'www.trakt.tv']);
  const positive = id => /^\d+$/.test(String(id)) && Number.isSafeInteger(Number(id)) && Number(id) > 0;
  function route() {
    const m = location.pathname.match(/^\/(movies|shows)\/([a-z0-9][a-z0-9-]*)\/?$/i);
    return m && { group:m[1], slug:m[2], key:`${m[1]}/${m[2]}` };
  }
  function publish(data) {
    window.dispatchEvent(new CustomEvent('nuvio:metadata', {detail:JSON.stringify(data)}));
  }
  function remember(group, body, source, lookupSlug) {
    const slug = body?.ids?.slug ?? body?.slug;
    const id = body?.ids?.tmdb ?? body?.tmdbId;
    const imdb = body?.ids?.imdb ?? body?.imdbId;
    const validImdb = /^tt\d{7,12}$/.test(imdb || '');
    if (!body?.title || typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/i.test(slug) || (!positive(id) && !validImdb)) return;
    const data = {key:`${group}/${slug}`, id:positive(id)?String(Number(id)):null, imdb:validImdb?imdb:null, source};
    seen.set(data.key, data);
    if (seen.size > 100) seen.delete(seen.keys().next().value);
    publish(data);
    if (/^tt\d{7,12}$/.test(lookupSlug || '') && lookupSlug === imdb) {
      const alias = {...data, key:`${group}/${lookupSlug}`};
      seen.set(alias.key, alias);if(seen.size>100)seen.delete(seen.keys().next().value);publish(alias);
    }
  }
  function summary(url) {
    try {
      const u = new URL(url, location.href);
      if (u.protocol !== 'https:' || !hosts.has(u.hostname)) return null;
      return u.pathname.match(/^\/(?:api\/(?:trakt\/)?)?(movies|shows)\/([^/]+)\/?$/);
    } catch { return null; }
  }
  const original = window.fetch;
  window.fetch = function (...args) {
    const result = Reflect.apply(original, this, args);
    result.then(response => {
      const url = response.url || (typeof args[0] === 'string' ? args[0] : args[0]?.url);
      const m = summary(url);
      if (!m || response.ok === false) return;
      response.clone().json().then(body => remember(m[1], body, 'Trakt response', m[2])).catch(() => {});
    }).catch(() => {});
    return result;
  };
  // Some older Trakt builds use XHR. Do not change the response or request.
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.addEventListener('load', () => {
      const m = summary(this.responseURL || url);
      if (!m || this.status < 200 || this.status >= 300) return;
      try {
        const body = this.responseType === 'json' ? this.response : JSON.parse(this.responseText);
        remember(m[1], body, 'Trakt response', m[2]);
      } catch {}
    }, {once:true});
    return Reflect.apply(open, this, [method,url,...rest]);
  };
  let reading = false;
  async function readCache() {
    const r = route();
    if (!r || reading || !window.indexedDB?.databases) return;
    reading = true;
    let db;
    try {
      // Verify existence first: never create or upgrade Trakt's database.
      const databases = await indexedDB.databases();
      if (!databases.some(d => d.name === 'trakt-query')) return;
      db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('trakt-query');
        request.onupgradeneeded = () => { request.transaction.abort(); reject(new Error('Cache missing')); };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Cache busy'));
      });
      if (!db.objectStoreNames.contains('query-cache')) return;
      await new Promise((resolve, reject) => {
        const tx = db.transaction('query-cache','readonly');
        const store = tx.objectStore('query-cache');
        const cursor = store.openKeyCursor();
        cursor.onsuccess = () => {
          const row = cursor.result;
          if (!row) return;
          try {
            const key = String(row.key);
            const query = JSON.parse(key.slice(key.indexOf('[')));
            const name = r.group === 'movies' ? 'movieSummary' : 'showSummary';
            // Read values only for the exact title-summary key and exact slug.
            if (Array.isArray(query) && new RegExp(`^query:${name}(?::v\\d+)?$`).test(query[0]) && query.includes(`dependency:${r.slug}`)) {
              const get = store.get(row.key);
              get.onsuccess = () => {
                const data = get.result?.state?.data;
                if ((data?.slug ?? data?.ids?.slug) !== r.slug && (!/^tt\d{7,12}$/.test(r.slug) || (data?.imdbId ?? data?.ids?.imdb) !== r.slug)) return;
                if (data?.type && data.type !== (r.group === 'movies' ? 'movie' : 'show')) return;
                remember(r.group, data, 'Trakt cache', r.slug);
              };
            }
          } catch {}
          row.continue();
        };
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
      });
    } catch { /* Cache disabled, absent, or busy: response and DOM paths still work. */ }
    finally { db?.close(); reading = false; }
  }
  window.addEventListener('nuvio:request', () => {
    const r = route();
    if (r && seen.has(r.key)) {publish(seen.get(r.key));return;}
    readCache();
  });
})();
