(() => {
  const params=new URLSearchParams(location.hash.slice(1));
  const source=NuvioLinks.source(params.get('source'));
  const kind=params.get('kind');
  const status=document.getElementById('status');const action=document.getElementById('launch');const retry=document.getElementById('retry');
  document.getElementById('icon').src=globalThis.NuvioButtonIcon;
  let running=false;
  async function open(){
    if(running)return;
    if(!source||!['movie','series'].includes(kind)){status.textContent='This is not a supported movie or series link.';return;}
    running=true;retry.hidden=true;action.hidden=true;status.textContent=source.provider==='trakt'?'Reading the exact title ID in a temporary background Trakt tab…':'Preparing the exact title link…';
    const original=document.getElementById('source');original.href=source.url;original.hidden=false;
    try{
      await globalThis.NuvioSettings?.ready;
      if(globalThis.NuvioSettings&&!NuvioSettings.get().enabled)throw new Error('The extension is paused. Enable it in Nuvio settings.');
      const result=await chrome.runtime.sendMessage({type:'nuvio:resolve-link',source:source.url,kind});
      if(globalThis.NuvioSettings&&!NuvioSettings.get().enabled)throw new Error('The extension is paused. Enable it in Nuvio settings.');
      const parsed=result?.url&&new URL(result.url);
      if(!parsed||parsed.protocol!=='nuvio:'||NuvioLinks.deepLink({provider:parsed.hostname,id:parsed.pathname.split('/')[2]},parsed.pathname.split('/')[1]==='tv'?'series':parsed.pathname.split('/')[1])!==result.url)throw new Error(result?.error||'The exact title could not be resolved.');
      action.href=result.url;action.hidden=false;status.textContent=`Ready to open ${result.kind==='series'?'series':'movie'} · ${result.identity}`;
      // The visible anchor remains available if Chrome requires another user gesture.
      if(!globalThis.NuvioSettings||NuvioSettings.get().autoLaunch)action.click();
    }catch(error){status.textContent=error.message||'Lookup failed. Please retry.';retry.hidden=false;}
    finally{running=false;}
  }
  retry.onclick=open;open();
})();
