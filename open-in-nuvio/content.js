(() => {
  const C = globalThis.NuvioCore;
  let current, resolved, host, shadow, action, status, timer;
  let previousLinks = [];
  let retryTimers = [];
  const blocked = new WeakMap();
  const metadata = new Map();
  const imdbIds = new Map();
  let lastReported;
  const selector =
    '.trakt-media-links a[href], #external-links a[href], .external-links a[href], #info a[href]';
  function candidates() {
    return [...document.querySelectorAll(selector)].filter(
      (a) =>
        !a.closest(
          '[data-nuvio], .grid-item, .trakt-card, [class*="related"], [class*="recommendation"]',
        ),
    );
  }
  function mount() {
    const bar = [...document.querySelectorAll('.trakt-summary-actions-bar')].find(
      (b) => !b.closest('[role="dialog"], .trakt-summary-drawer'),
    );
    if (host) {
      place(bar);
      return;
    }
    if (!document.body) return;
    host = document.createElement('div');
    host.dataset.nuvio = '';
    host.style.cssText = 'all:initial;display:block;position:relative;flex:0 0 auto;';
    shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>
      :host{color-scheme:dark}*{box-sizing:border-box}section{position:relative;font:13px/1.4 -apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#eee}
      a,button{font-family:inherit;font-weight:600;font-size:13px;line-height:1.2}a{--accent-action-button:var(--color-accent-purple,var(--color-background-purple,#be80dd));display:flex;align-items:center;justify-content:center;gap:7px;text-decoration:none;color:var(--accent-action-button);height:var(--ni-40,40px);padding:var(--ni-6,6px) var(--ni-10,10px);border:0;border-radius:var(--border-radius-m,12px);background-color:transparent;box-shadow:inset 0 0 0 var(--border-thickness-xxs,1px) color-mix(in srgb,var(--accent-action-button) 30%,transparent);cursor:pointer;white-space:nowrap;flex-shrink:0;user-select:none;-webkit-tap-highlight-color:transparent;transition:background-color var(--transition-increment,150ms) cubic-bezier(.22,1,.36,1),color var(--transition-increment,150ms),box-shadow var(--transition-increment,150ms)}a:hover{background-color:color-mix(in srgb,var(--accent-action-button) 15%,transparent);box-shadow:inset 0 0 0 var(--border-thickness-xxs,1px) color-mix(in srgb,var(--accent-action-button) 60%,transparent)}a[aria-disabled=true]{color:#b7adbe;border-color:#57485e}a:focus-visible,button:focus-visible{outline:2px solid #d2a2ef;outline-offset:3px}img{width:20px;height:20px;object-fit:contain;flex:none}a[hidden]{display:none}.imdb{--accent-action-button:var(--color-accent-yellow,#f5c518);margin-left:8px}.links{display:flex;flex-wrap:wrap;align-items:center}.imdb-mark{font:bold 10px Arial,sans-serif;background:#f5c518;color:#111;border-radius:3px;padding:4px 2px}
      .details{display:none;position:absolute;bottom:calc(100% + 10px);right:0;width:max-content;z-index:var(--layer-top,100);white-space:nowrap;background-color:var(--color-tooltip-background,#303034);color:var(--color-tooltip-text,#f5f5f5);font-size:var(--ni-12,12px);border:0;border-radius:var(--border-radius-xs,4px);padding:var(--ni-6,6px) var(--ni-8,8px);box-shadow:var(--shadow-menu,0 4px 15px #0004);font-weight:500;line-height:1}.details.pending{max-width:var(--ni-276,276px);white-space:normal;border-radius:var(--border-radius-s,8px);padding:var(--ni-10,10px);line-height:1.4}
      section:has(.nuvio:hover) .details:not(.imdb-tooltip),section:has(.nuvio:focus-visible) .details:not(.imdb-tooltip),.details:hover,.details:focus-within{display:block}p{margin:0;font:inherit;color:inherit}button{color:#dab2f1;border:0;background:none;padding:8px 0 0;cursor:pointer}
      .imdb-tooltip{right:0}section:has(.imdb:hover) .imdb-tooltip,section:has(.imdb:focus-visible) .imdb-tooltip{display:block}section:has(.imdb:hover) .details:not(.imdb-tooltip){display:none}
      </style><section aria-label="Nuvio Desktop"><div class="links"><a class="nuvio" role="link" tabindex="0" aria-label="Open in Nuvio" aria-disabled="true"><img src="${globalThis.NuvioButtonIcon}" alt="" aria-hidden="true"><span>Open in Nuvio</span></a><a class="imdb" aria-label="Open in IMDb" target="_blank" rel="noopener noreferrer" hidden><span class="imdb-mark" aria-hidden="true">IMDb</span><span>Open in IMDb</span></a></div><div class="details"><p role="status" aria-live="polite"></p><button type="button" hidden>Retry lookup</button></div><div class="details imdb-tooltip" role="tooltip">Open in IMDb</div></section>`;
    globalThis.NuvioSettings?.apply('trakt', host, shadow);
    action = shadow.querySelector('a');
    status = shadow.querySelector('p');
    action.addEventListener('click', (event) => {
      if (C.route(location.href)?.key !== current?.key || !resolved) {
        event.preventDefault();
        update();
        window.dispatchEvent(new Event('nuvio:request'));
        return;
      }
      status.textContent = 'Open in Nuvio Desktop';
    });
    shadow.querySelector('.imdb').addEventListener('click', (event) => {
      if (C.route(location.href)?.key !== current?.key) {
        event.preventDefault();
        update();
      }
    });
    action.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        action.click();
      }
    });
    shadow.querySelector('button').onclick = () => {
      window.dispatchEvent(new Event('nuvio:request'));
      update();
    };
    place(bar);
  }
  function place(bar) {
    if (bar) {
      if (!document.getElementById('nuvio-bar-style')) {
        const style = document.createElement('style');
        style.id = 'nuvio-bar-style';
        style.textContent =
          '.trakt-summary-actions-bar:has(> [data-nuvio]){width:max-content!important;max-width:100%!important;height:auto!important;min-height:var(--ni-56,56px);flex-wrap:wrap}';
        document.documentElement.append(style);
      }
      const more = bar.querySelector('.trakt-media-actions-popup-button');
      const before =
        more && [...bar.children].find((c) => c === more || c.contains(more));
      if (host.parentElement !== bar) bar.insertBefore(host, before || null);
      host.style.position = 'relative';
      host.style.bottom = '';
      host.style.right = '';
      host.style.zIndex = '';
    } else {
      // Keep the control detached until the title action bar is available.
      host.remove();
    }
  }
  function update() {
    const route = C.route(location.href);
    if (route?.key !== current?.key) {
      for (const [a, href] of previousLinks) blocked.set(a, href);
      current = route;
      resolved = null;
      retryTimers.forEach(clearTimeout);
      retryTimers = route
        ? [0, 500, 1500, 4000, 10000].map((ms) =>
            setTimeout(() => {
              if (current?.key === route.key && !resolved)
                window.dispatchEvent(new Event('nuvio:request'));
            }, ms),
          )
        : [];
    }
    if (!route) {
      host?.remove();
      return;
    }
    mount();
    if (!action) return;
    previousLinks = candidates().map((a) => [a, a.href]);
    const ids = new Set(
      candidates()
        .filter((a) => blocked.get(a) !== a.href)
        .map((a) => C.tmdb(a.href, route.kind))
        .filter(Boolean),
    );
    resolved = metadata.get(route.key) || (ids.size === 1 ? [...ids][0] : null);
    const domImdb = new Set(
      candidates()
        .filter((a) => blocked.get(a) !== a.href)
        .map((a) => {
          try {
            const u = new URL(a.href);
            return ['imdb.com', 'www.imdb.com', 'm.imdb.com'].includes(u.hostname) &&
              u.protocol === 'https:'
              ? u.pathname.match(/^\/title\/(tt\d{7,12})\/?$/)?.[1]
              : null;
          } catch {
            return null;
          }
        })
        .filter(Boolean),
    );
    const imdb = imdbIds.get(route.key) || (domImdb.size === 1 ? [...domImdb][0] : null);
    const imdbAction = shadow.querySelector('.imdb');
    imdbAction.hidden = !imdb;
    if (imdb) imdbAction.href = `https://www.imdb.com/title/${imdb}/`;
    else imdbAction.removeAttribute('href');
    const report = JSON.stringify([route.key, resolved, imdb]);
    if (
      (resolved || imdb) &&
      report !== lastReported &&
      globalThis.chrome?.runtime?.sendMessage
    ) {
      lastReported = report;
      chrome.runtime
        .sendMessage({
          type: 'nuvio:trakt-ready',
          key: route.key,
          tmdb: resolved || null,
          imdb: imdb || null,
        })
        .catch(() => {});
    }

    shadow.querySelector('.details').classList.toggle('pending', !resolved);
    if (resolved) {
      action.href = C.link(route.kind, resolved);
      action.setAttribute('aria-disabled', 'false');
      status.textContent = 'Open in Nuvio Desktop';
      action.removeAttribute('title');
      shadow.querySelector('button').hidden = true;
    } else {
      action.removeAttribute('href');
      action.setAttribute('aria-disabled', 'true');
      status.textContent =
        'Looking for this title’s TMDB ID in Trakt’s response, cache, or external links. Click to retry, or reload the page.';
      action.removeAttribute('title');
      shadow.querySelector('button').hidden = false;
    }
    if (globalThis.NuvioSettings && !NuvioSettings.apply('trakt', host, shadow))
      host.remove();
  }
  window.addEventListener('nuvio:metadata', (event) => {
    try {
      const data = JSON.parse(event.detail);
      if (
        typeof data.key === 'string' &&
        /^(movies|shows)\/[a-z0-9-]+$/i.test(data.key) &&
        (C.positive(data.id) || /^tt\d{7,12}$/.test(data.imdb || ''))
      ) {
        if (C.positive(data.id)) metadata.set(data.key, C.positive(data.id));
        if (/^tt\d{7,12}$/.test(data.imdb || '')) imdbIds.set(data.key, data.imdb);
        if (imdbIds.size > 100) imdbIds.delete(imdbIds.keys().next().value);
        if (metadata.size > 100) metadata.delete(metadata.keys().next().value);
        update();
      }
    } catch {}
  });
  globalThis.chrome?.runtime?.onMessage?.addListener((message) => {
    if (message?.type === 'nuvio:report-title') {
      lastReported = null;
      update();
      window.dispatchEvent(new Event('nuvio:request'));
    }
  });
  globalThis.chrome?.runtime?.onMessage?.addListener((message, sender, reply) => {
    if (message?.type !== 'nuvio:current-link' || sender.id !== chrome.runtime.id) return;
    update();
    reply({
      url:
        globalThis.NuvioSettings?.visible('trakt') && resolved && current
          ? C.link(current.kind, resolved)
          : null,
    });
  });
  function schedule(records) {
    if (records.every((r) => r.target === host || r.target?.closest?.('[data-nuvio]')))
      return;
    clearTimeout(timer);
    timer = setTimeout(update, 80);
  }
  new MutationObserver(schedule).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['href'],
  });
  window.addEventListener('popstate', update);
  window.addEventListener('pageshow', update);
  // Isolated-world polling also catches pushState/replaceState made by any framework.
  setInterval(() => {
    if (C.route(location.href)?.key !== current?.key || !host?.isConnected) update();
  }, 200);
  globalThis.NuvioSettings?.subscribe(update);
  update();
  window.dispatchEvent(new Event('nuvio:request'));
})();
