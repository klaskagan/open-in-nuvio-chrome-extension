(() => {
  const positive = x => /^\d+$/.test(String(x)) && Number.isSafeInteger(Number(x)) && Number(x) > 0 ? String(Number(x)) : null;
  function route(value) {
    const u = new URL(value, 'https://trakt.tv');
    const m = u.pathname.match(/^\/(movies|shows)\/([a-z0-9][a-z0-9-]*)\/?$/i);
    return m ? {kind:m[1] === 'movies' ? 'movie' : 'tv', slug:m[2], key:`${m[1]}/${m[2]}`} : null;
  }
  function tmdb(value, kind) {
    try {
      const u = new URL(value);
      if (!['themoviedb.org','www.themoviedb.org'].includes(u.hostname) || u.protocol !== 'https:') return null;
      const m = u.pathname.match(/^\/(movie|tv)\/(\d+)(?:-[^/]*)?\/?$/);
      return m && m[1] === kind ? positive(m[2]) : null;
    } catch { return null; }
  }
  globalThis.NuvioCore = {positive,route,tmdb,link:(kind,id) => `nuvio://tmdb/${kind}/${positive(id)}`};
})();
