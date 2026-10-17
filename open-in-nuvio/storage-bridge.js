(() => {
  // Chrome 116+ supports restricting local extension storage to trusted contexts.
  const secured = Promise.resolve().then(() =>
    chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
  );
  secured.catch(() => {}); // Request handlers report failure without exposing storage.
  const allowed = (sender) => {
    if (sender.id !== chrome.runtime.id || sender.frameId !== 0) return false;
    try {
      const u = new URL(sender.url);
      return (
        u.protocol === 'https:' &&
        ([
          'trakt.tv',
          'www.trakt.tv',
          'app.trakt.tv',
          'imdb.com',
          'www.imdb.com',
          'm.imdb.com',
        ].includes(u.hostname) ||
          (NuvioGoogle.googleHost(u.hostname) && u.pathname === '/search'))
      );
    } catch {
      return false;
    }
  };
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.type !== 'nuvio:settings-read' || !allowed(sender)) return;
    Promise.all([secured, NuvioSettings.ready])
      .then(() => reply({ settings: NuvioSettings.get() }))
      .catch(() =>
        reply({
          error:
            'Extension settings are unavailable. Reload the extension and this page.',
        }),
      );
    return true;
  });
  let previous;
  NuvioSettings.subscribe((settings) => {
    const serialized = JSON.stringify(settings);
    if (serialized === previous) return;
    previous = serialized;
    // Coalesce duplicate storage/save notifications and never forward credential changes.
    Promise.resolve(secured)
      .then(async () => {
        const patterns = chrome.runtime.getManifest().host_permissions;
        const tabs = await chrome.tabs.query({ url: patterns });
        await Promise.allSettled(
          tabs.map((tab) =>
            chrome.tabs.sendMessage(
              tab.id,
              { type: 'nuvio:settings-changed', settings },
              { frameId: 0 },
            ),
          ),
        );
      })
      .catch(() => {});
  });
})();
