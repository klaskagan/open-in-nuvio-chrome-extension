// Content scripts receive preferences only; account credentials remain in trusted storage.
(() => {
 const listeners=new Set();let latest,revision=0;
 chrome.runtime.onMessage.addListener((message,sender)=>{
  if(sender.id!==chrome.runtime.id||message?.type!=='nuvio:settings-changed')return;
  latest=message.settings;revision++;for(const listener of listeners)listener({nuvioSettings:{newValue:latest}},'local');
 });
 globalThis.NuvioSettingsStorage={
  get:async()=>{const before=revision;const response=await chrome.runtime.sendMessage({type:'nuvio:settings-read'});if(!response||response.error)throw Error(response?.error||'Could not read settings');return {nuvioSettings:before===revision?response.settings:latest};},
  set:async()=>{throw Error('Change preferences in the extension settings.');},
  subscribe:listener=>listeners.add(listener)
 };
})();
