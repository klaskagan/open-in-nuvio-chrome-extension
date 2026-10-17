(() => {
  const pending = new Set();
  chrome.commands?.onCommand?.addListener(async (command, tab) => {
    if (command !== 'open-current-nuvio') return;
    await NuvioSettings.ready;
    if (!NuvioSettings.get().enabled) return;
    try {
      if (!tab?.id)
        [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || pending.has(tab.id)) return;
      pending.add(tab.id);
      try {
        const source = NuvioLinks.source(tab.url);
        let allowed = Boolean(source);
        if (!allowed) {
          const u = new URL(tab.url);
          allowed =
            u.protocol === 'https:' &&
            u.pathname === '/search' &&
            NuvioGoogle.googleHost(u.hostname);
        }
        if (!allowed) return;
        const r = await chrome.tabs.sendMessage(
          tab.id,
          { type: 'nuvio:current-link' },
          { frameId: 0 },
        );
        // Validate the resolved target; never navigate to a page-supplied arbitrary URL.
        if (
          !/^nuvio:\/\/(?:imdb\/(?:movie|series)\/tt\d{7,12}|tmdb\/(?:movie|tv)\/[1-9]\d*)$/.test(
            r?.url || '',
          )
        )
          return;
        await chrome.tabs.update(tab.id, { url: r.url });
      } finally {
        pending.delete(tab.id);
      }
    } catch {
      /* Unavailable content scripts and unresolved titles are a no-op. */
    }
  });
})();
