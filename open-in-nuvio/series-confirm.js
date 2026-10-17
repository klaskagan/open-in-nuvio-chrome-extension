(() => {
 let dismiss;
 function cancel(){dismiss?.(false);}
 function ask(plan,desired,valid=()=>true){
  cancel();if(!valid())return Promise.resolve(false);
  return new Promise(resolve=>{
   const previous=document.activeElement,host=document.createElement('div');host.dataset.nuvioSeriesDialog='';const root=host.attachShadow({mode:'closed'});
   root.innerHTML='<style>:host{all:initial}*{box-sizing:border-box}dialog{color:#f7f5f9;background:#111014;border:1px solid #353239;border-radius:20px;padding:28px;max-width:580px;width:calc(100vw - 40px);font:16px/1.45 Arial,sans-serif;box-shadow:0 20px 80px #0008}dialog::backdrop{background:#0008;backdrop-filter:blur(3px)}h2{font-size:23px;margin:0 0 12px}p{color:#b8b3bf;margin:0 0 8px}.buttons{display:flex;justify-content:flex-end;gap:10px;margin-top:25px}button{font:600 15px Arial;padding:13px 20px;border:1px solid #65606b;border-radius:12px;background:transparent;color:#fff;cursor:pointer}button.confirm{background:#d6a1ef;color:#24152c;border-color:transparent}button:focus-visible{outline:3px solid #e7d9ef;outline-offset:3px}</style><dialog aria-labelledby="heading" aria-describedby="description scope"><h2 id="heading"></h2><p id="description"></p><p id="scope"></p><div class="buttons"><button class="cancel" autofocus>Cancel</button><button class="confirm"></button></div></dialog>';
   const dialog=root.querySelector('dialog');root.querySelector('h2').textContent=desired?'Mark as watched?':'Mark as unwatched?';root.querySelector('#description').textContent=desired?`Mark ${plan.count} unwatched episode${plan.count===1?'':'s'} of “${plan.title}” as watched across all regular seasons?`:`Remove all recorded viewings of ${plan.count} aired episode${plan.count===1?'':'s'} of “${plan.title}”?`;
   root.querySelector('#scope').textContent='Specials and unaired episodes stay unchanged.';root.querySelector('.confirm').textContent=desired?'Mark as Watched':'Mark as Unwatched';
   let done=false;const finish=value=>{if(done)return;done=true;if(dismiss===finish)dismiss=null;dialog.close();host.remove();previous?.focus?.();resolve(Boolean(value&&valid()));};dismiss=finish;
   root.querySelector('.cancel').onclick=()=>finish(false);root.querySelector('.confirm').onclick=()=>finish(true);dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false)});document.documentElement.append(host);dialog.showModal();
  });
 }
 globalThis.NuvioSeriesConfirm={ask,cancel};
})();
