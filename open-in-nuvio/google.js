(() => {
  const G = globalThis.NuvioGoogle;
  const memo = new Map();
  const blocked = new WeakMap();
  let host,shadow,currentQuery,previous=[],timer,currentStamp,lastEvidence,blockedEvidence,lookupStatus;
  const watchSelector = '[data-attrid$=":media_actions_wholepage"], [data-attrid$=":media_actions"]';
  function status(target,error,key){
    if(!target||!error){lookupStatus?.remove();return;}
    if(!lookupStatus){lookupStatus=document.createElement('div');lookupStatus.dataset.nuvioGoogleStatus='';lookupStatus.style.cssText='font:12px/1.5 Arial,sans-serif;color:#b6a4c1;margin:12px 0;';lookupStatus.setAttribute('role','status');}
    if(lookupStatus.dataset.key!==key||lookupStatus.dataset.error!==error){lookupStatus.replaceChildren();lookupStatus.dataset.key=key;lookupStatus.dataset.error=error;const text=document.createElement('span');text.textContent='Trakt: '+error+' ';const retry=document.createElement('button');retry.type='button';retry.textContent='Retry';retry.style.cssText='color:#d2abea;background:transparent;border:1px solid #705184;border-radius:8px;padding:3px 9px;cursor:pointer';retry.onclick=()=>{memo.delete(key);status();update();};lookupStatus.append(text,retry);}
    if(lookupStatus.parentElement!==target)target.append(lookupStatus);
  }
  function query() {
    const u = new URL(location.href);
    return u.pathname === '/search' && !['isch','vid','nws','shop'].includes(u.searchParams.get('tbm')) && !['2','7','28','39','50'].includes(u.searchParams.get('udm')) ? JSON.stringify([u.searchParams.get('q'),u.searchParams.get('kgmid'),u.searchParams.get('tbm'),u.searchParams.get('udm')]) : null;
  }
  function panel() {
    const movie = document.querySelector('[data-attrid^="kc:/film/film:"]');
    const series = document.querySelector('[data-attrid^="kc:/tv/tv_program:"], [data-attrid^="kc:/tv/tv_series:"]');
    if (Boolean(movie) === Boolean(series)) return null;
    const kind = movie ? 'movie' : 'series';
    const title = document.querySelector('[data-attrid="title"]');
    if (!title?.textContent.trim()) return null;
    const ratings = [...document.querySelectorAll('[data-md="17"], [data-attrid$=":ratings"], [data-attrid$=":reviews"]')];
    const anchors = ratings.flatMap(r => [...r.querySelectorAll('a[href]')]).filter(a => {
      if (a.closest('[data-nuvio-google]')) return false;
      const label = `${a.textContent} ${a.getAttribute('aria-label') || ''} ${[...a.querySelectorAll('[aria-label]')].map(n=>n.getAttribute('aria-label')).join(' ')}`;
      return /IMDb/i.test(label);
    });
    let unique = [...new Set(anchors)].filter(a => blocked.get(a) !== a.href);
    const watch = [...document.querySelectorAll(watchSelector)].find(e => e.getAttribute('data-attrid').startsWith(movie ? 'kc:/film/film:' : 'kc:/tv/'));
    let evidence=null;
    if(!unique.length&&watch){
      const subtitle=document.querySelector('[data-attrid="subtitle"]')?.textContent||'';
      const year=Number(subtitle.match(/^\s*((?:18|19|20)\d{2})\b/)?.[1]);
      const titles=[title.textContent.trim()];
      const escaped=Array.from(titles[0]).map(c=>'\\^$.*+?()[]{}|'.includes(c)?'\\'+c:c).join('');
      for(const node of document.querySelectorAll('[data-attrid="VisualDigestWebResult"],[data-attrid="description"]')){
        const text=node.textContent.slice(0,3000);
        const paired=text.match(new RegExp(escaped+'\\s*\\(([^)]+)\\)','i'));
        const english=text.match(/\(\s*angl\.\s*([^)]{2,150})\)/i);
        const alias=(paired?.[1]||english?.[1])?.trim();if(alias&&alias.length<=150)titles.push(alias);
      }
      // Google's translated About section retains its original English text in a leaf span.
      for(const leaf of document.querySelectorAll('[data-attrid="description"] span')){
        if(leaf.children.length)continue;const m=leaf.textContent.trim().match(/^(.{2,150}?) is (?:a|an) ((?:18|19|20)\d{2})\b[^.]{0,160}\b(?:film|movie|series)\b/i);
        if(m&&Number(m[2])===year)titles.push(m[1].trim());
      }
      // A Wikipedia result can explicitly pair the selected localized heading with its original title.
      for(const a of document.querySelectorAll('a:has(h3)')){
        let u;try{u=new URL(a.href);}catch{continue;}if(!/(^|\.)wikipedia\.org$/.test(u.hostname)||a.querySelector('h3').textContent.trim()!==titles[0])continue;
        let parent=a;for(let i=0;i<6&&parent;i++,parent=parent.parentElement){const m=parent.textContent.slice(0,5000).match(new RegExp(escaped+'\\s*\\(\\s*angl\\.\\s*([^)]{2,150})\\)','i'));if(m){titles.push(m[1].trim());break;}}
      }
      for(const alias of titles[0].matchAll(/\(([^)]+)\)/g))titles.push(alias[1].trim());if(titles[0].includes('('))titles.push(titles[0].split('(')[0].trim());
      if(year>=1880&&year<=2100){
        evidence={kind,year,titles:[...new Set(titles)].filter((t,i)=>i===0||/\p{L}/u.test(t)).slice(0,4),directors:[...document.querySelectorAll('[data-attrid$=":director"] a')].map(a=>a.textContent.trim()).filter(Boolean).slice(0,5)};
        const normalize=t=>t.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,'and').replace(/[^\p{L}\p{N}]/gu,'');
        unique=[...document.querySelectorAll('a[href]')].filter(a=>{
          if(!G.identity(a.href))return false;const heading=a.querySelector('h3');if(!heading)return false;
          const m=heading.textContent.trim().match(/^(.*?)\s*\((?:(TV Movie|TV Series|TV Mini Series)\s+)?(\d{4})(?:[–-]\d{0,4})?\)/);
          return m&&(!m[2]||(kind==='movie'?m[2]==='TV Movie':m[2]!=='TV Movie'))&&Number(m[3])===year&&titles.some(t=>normalize(t)===normalize(m[1]));
        }).filter(a=>blocked.get(a)!==a.href);
      }
    }
    if(!unique.length&&!evidence)return null;
    if(evidence&&JSON.stringify(evidence)===blockedEvidence)return null;
    return {kind,title:title.textContent.trim(),anchors:unique,evidence,target:watch || ratings.find(r=>r.contains(unique[0]))};
  }
  function stamp(p) { return JSON.stringify([currentQuery,p.kind,p.title,p.anchors.map(a=>a.href),p.evidence]); }
  function mount() {
    if (host) return;
    host = document.createElement('div');host.dataset.nuvioGoogle='';
    host.style.cssText='all:initial;display:block;width:100%;box-sizing:border-box;margin:14px 0 6px;';
    shadow=host.attachShadow({mode:'closed'});
    shadow.innerHTML=`<style>*{box-sizing:border-box}.row{display:flex;flex-wrap:wrap;gap:8px;font:600 14px/1.25 Arial,sans-serif}a{flex:1 1 140px;display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:10px 14px;border-radius:24px;text-decoration:none;color:#e4bdf8;background:#241a2e;border:1px solid #805797;white-space:nowrap}a:hover{background:#392348}.trakt{color:#eee;background:#292a2d;border-color:#73767a}.trakt:hover{background:#3c4043}.imdb{color:#f5c518;background:#211e16;border-color:#756338}.imdb-mark{font:bold 10px Arial,sans-serif;background:#f5c518;color:#111;border-radius:3px;padding:4px 2px}img{width:20px;height:20px;object-fit:contain}a:focus-visible{outline:3px solid #8ab4f8;outline-offset:3px}</style><div class="row" aria-label="Open this movie or series"><a class="nuvio" aria-label="Open in Nuvio"><img src="${globalThis.NuvioButtonIcon}" alt=""><span>Open in Nuvio</span></a><a class="trakt" aria-label="Open in Trakt" target="_blank" rel="noopener noreferrer"><img src="${globalThis.TraktButtonIcon}" alt=""><span>Open in Trakt</span></a><a class="imdb" aria-label="Open in IMDb" target="_blank" rel="noopener noreferrer"><span class="imdb-mark" aria-hidden="true">IMDb</span><span>Open in IMDb</span></a></div>`;
    for(const a of shadow.querySelectorAll('a')) a.addEventListener('click',e=>{
      const p=panel();
      if(query()!==currentQuery || !p || stamp(p)!==currentStamp){e.preventDefault();update();}
    });
  }
  function update() {
    timer=null;
    if(globalThis.NuvioSettings&&!NuvioSettings.visible('google')){host?.remove();globalThis.NuvioGoogleTrakt?.clear();status();return;}
    const next=query();
    if(next!==currentQuery){
      for(const [a,href]of previous) blocked.set(a,href);
      blockedEvidence=lastEvidence;currentQuery=next;currentStamp=null;host?.remove();
    }
    if(!next){host?.remove();globalThis.NuvioGoogleTrakt?.clear();status();return;}
    const p=panel();
    if(!p?.target){host?.remove();globalThis.NuvioGoogleTrakt?.clear();status();return;}
    lastEvidence=JSON.stringify(p.evidence);previous=p.anchors.map(a=>[a,a.href]);
    const ids=new Map();let waiting=false;
    for(const a of p.anchors){
      let value=G.identity(a.href);
      if(!value){
        const wrapped=G.wrapped(a.href);
        if(wrapped){
          const key=JSON.stringify(wrapped);
          const entry=memo.get(key);
          if(!entry){
            waiting=true;memo.set(key,{pending:true});
            const message={type:'nuvio:google-rating',...wrapped};
            Promise.resolve().then(()=>chrome.runtime.sendMessage(message)).then(result=>{
              memo.set(key,{value:result?.identity || null});update();
            }).catch(()=>{memo.set(key,{value:null});update();});
          }else if(entry.pending) waiting=true;
          else value=entry.value;
        }
      }
      if(value && G.links(value,p.kind)) ids.set(`${value.provider}:${value.id}`,value);
    }
    if(!p.anchors.length&&p.evidence){
      const key='panel:'+JSON.stringify(p.evidence);const entry=memo.get(key);
      if(!entry){waiting=true;memo.set(key,{pending:true});Promise.resolve().then(()=>chrome.runtime.sendMessage({type:'nuvio:trakt-identify',...p.evidence})).then(r=>{memo.set(key,{value:r?.identity||null,error:r?.error||(!r?.identity?'This title could not be identified.':null)});update();}).catch(()=>{memo.set(key,{value:null,error:'Lookup failed. Please retry.'});update();});}
      else if(entry.pending)waiting=true;
      else if(entry.value&&G.links(entry.value,p.kind))ids.set('imdb:'+entry.value.id,entry.value);
    }
    // Multiple rating providers may coexist. IMDb is preferred only if unambiguous.
    const imdb=[...ids.values()].filter(v=>v.provider==='imdb');
    const chosen=imdb.length===1 ? imdb[0] : imdb.length===0 && ids.size===1 ? [...ids.values()][0] : null;
    if(waiting || !chosen){host?.remove();globalThis.NuvioGoogleTrakt?.clear();const key=p.evidence?'panel:'+JSON.stringify(p.evidence):'',entry=key&&memo.get(key);status(!waiting&&entry?.error?p.target:null,entry?.error,key);return;}
    const urls=G.links(chosen,p.kind);
    if(!urls){host?.remove();globalThis.NuvioGoogleTrakt?.clear();status();return;}
    status();mount();currentStamp=stamp(p);
    globalThis.NuvioGoogleTrakt?.sync({id:chosen.id,kind:p.kind,target:p.target,key:currentStamp,valid:()=>{const live=panel();return query()===currentQuery&&live&&stamp(live)===currentStamp;}});
    for(const name of ['nuvio','trakt','imdb']){
      const link=shadow.querySelector(`.${name}`);
      if(link.getAttribute('href')!==urls[name])link.href=urls[name];
      link.title=`Open ${p.title} in ${name==='nuvio'?'Nuvio Desktop':name==='trakt'?'Trakt':'IMDb'}`;
    }
    if(host.parentElement!==p.target)p.target.append(host);
    globalThis.NuvioSettings?.apply('google',host,shadow);
  }
  chrome.runtime.onMessage?.addListener((message,sender,reply)=>{
    if(message?.type!=='nuvio:current-link'||sender.id!==chrome.runtime.id)return;
    update();const live=panel();reply({url:globalThis.NuvioSettings?.visible('google')&&host?.isConnected&&live&&stamp(live)===currentStamp?shadow.querySelector('.nuvio')?.getAttribute('href'):null});
  });
  function schedule(records){
    if(records?.every(r=>r.target===host || r.target?.closest?.('[data-nuvio-google],[data-nuvio-trakt-control],[data-nuvio-google-status]')))return;
    if(!timer)timer=setTimeout(update,80);
  }
  new MutationObserver(schedule).observe(document,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['href','data-attrid','data-md']});
  window.addEventListener('popstate',update);window.addEventListener('pageshow',update);
  // DOM observation handles late/replaced panels; polling only detects History API navigation.
  setInterval(()=>{if(query()!==currentQuery)update();},200);
  globalThis.NuvioSettings?.subscribe(update);
  update();
})();
