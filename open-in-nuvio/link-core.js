(() => {
  function source(value) {
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:') return null;
      const imdb = NuvioGoogle.identity(u.href);
      if (imdb) return {...imdb,url:`https://www.imdb.com/title/${imdb.id}/`};
      if (['trakt.tv','www.trakt.tv','app.trakt.tv'].includes(u.hostname)) {
        const m=u.pathname.match(/^\/(movies|shows)\/([a-z0-9][a-z0-9-]*)\/?$/i);
        if(m)return {provider:'trakt',kind:m[1]==='movies'?'movie':'series',key:`${m[1]}/${m[2]}`,url:`https://app.trakt.tv/${m[1]}/${m[2]}`};
      }
      const wrapped=NuvioGoogle.wrapped(u.href);
      if(wrapped)return {provider:'google',...wrapped,url:`https://${wrapped.host}/goto?url=${encodeURIComponent(wrapped.token)}`};
    }catch{}
    return null;
  }
  function deepLink(data,kind) {
    if(!['movie','series'].includes(kind))return null;
    if(data?.provider==='imdb'&&/^tt\d{7,12}$/.test(data.id))return `nuvio://imdb/${kind}/${data.id}`;
    if(data?.provider==='tmdb'&&/^\d+$/.test(String(data.id))&&Number.isSafeInteger(Number(data.id))&&Number(data.id)>0)return `nuvio://tmdb/${kind==='movie'?'movie':'tv'}/${Number(data.id)}`;
    return null;
  }
  globalThis.NuvioLinks={source,deepLink};
})();
