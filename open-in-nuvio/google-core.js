(() => {
  const domains = ['google.com', 'google.lt', 'google.co.uk'];
  function googleHost(host) {
    return domains.some((d) => host === d || host === `www.${d}`);
  }
  function identity(value) {
    try {
      let u = new URL(value, location.href);
      if (u.protocol !== 'https:') return null;
      for (let i = 0; i < 2 && googleHost(u.hostname) && u.pathname === '/url'; i++) {
        const dest = u.searchParams.get('q') || u.searchParams.get('url');
        if (!dest) return null;
        u = new URL(dest);
      }
      if (u.protocol !== 'https:') return null;
      if (['imdb.com', 'www.imdb.com', 'm.imdb.com'].includes(u.hostname)) {
        const m = u.pathname.match(/^\/title\/(tt\d{7,12})\/?$/);
        return m && { provider: 'imdb', id: m[1] };
      }
    } catch {}
    return null;
  }
  function wrapped(value) {
    try {
      const u = new URL(value, location.href);
      const token = u.searchParams.get('url');
      if (
        u.protocol === 'https:' &&
        googleHost(u.hostname) &&
        u.pathname === '/goto' &&
        /^[A-Za-z0-9_-]{10,2000}$/.test(token || '')
      )
        return { host: u.hostname, token };
    } catch {}
    return null;
  }
  function links(data, kind) {
    if (!data || !['movie', 'series'].includes(kind) || (data.kind && data.kind !== kind))
      return null;
    const segment = kind === 'movie' ? 'movies' : 'shows';
    if (data.provider === 'imdb' && /^tt\d{7,12}$/.test(data.id))
      return {
        nuvio: `nuvio://imdb/${kind}/${data.id}`,
        trakt: `https://app.trakt.tv/${segment}/${data.id}`,
        imdb: `https://www.imdb.com/title/${data.id}/`,
      };

    return null;
  }
  globalThis.NuvioGoogle = { googleHost, identity, wrapped, links };
})();
