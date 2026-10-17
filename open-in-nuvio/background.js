importScripts(
  'settings.js',
  'google-core.js',
  'storage-bridge.js',
  'link-core.js',
  'context-menu.js',
  'trakt-config.js',
  'trakt-api.js',
);
const cached = new Map();
const pending = new Map();
async function resolveGoogle(host, token) {
  const key = `${host}/${token}`;
  const old = cached.get(key);
  if (old && old.expires > Date.now()) return old.value;
  if (pending.has(key)) return pending.get(key);
  const task = (async () => {
    let value = null;
    try {
      // Fetch only a validated Google redirect, never a caller-supplied arbitrary URL.
      const response = await fetch(
        `https://${host}/goto?url=${encodeURIComponent(token)}`,
        {
          credentials: 'omit',
          redirect: 'follow',
          referrerPolicy: 'no-referrer',
          signal: AbortSignal.timeout(10000),
        },
      );
      value = NuvioGoogle.identity(response.url);
      await response.body?.cancel();
    } catch {}
    cached.set(key, { value, expires: Date.now() + (value ? 900000 : 30000) });
    if (cached.size > 100) cached.delete(cached.keys().next().value);
    return value;
  })();
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'nuvio:google-rating') return;
  try {
    const page = new URL(sender.url);
    if (
      sender.id !== chrome.runtime.id ||
      page.protocol !== 'https:' ||
      page.pathname !== '/search' ||
      !NuvioGoogle.googleHost(page.hostname)
    )
      return;
    if (
      message.host !== page.hostname ||
      !/^[A-Za-z0-9_-]{10,2000}$/.test(message.token || '')
    )
      return;
    Promise.resolve(globalThis.NuvioSettings?.ready)
      .then(() =>
        !globalThis.NuvioSettings ||
        (NuvioSettings.get().enabled && NuvioSettings.get().sites.google)
          ? resolveGoogle(page.hostname, message.token)
          : null,
      )
      .then((value) => respond({ identity: value }))
      .catch(() => respond({ identity: null }));
    return true;
  } catch {}
});

importScripts('shortcut.js');
