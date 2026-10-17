(() => {
  const defaults = {
    enabled: true,
    traktControls: false,
    sites: { trakt: true, imdb: true, google: true },
    buttons: {
      trakt: { nuvio: true, imdb: true },
      imdb: { nuvio: true, trakt: true },
      google: { nuvio: true, trakt: true, imdb: true },
    },
    appearance: 'auto',
    compact: false,
    linkTarget: 'new',
    contextMenu: true,
    autoLaunch: true,
  };
  const copy = (v) => JSON.parse(JSON.stringify(v));
  function normalize(raw) {
    const value = copy(defaults);
    if (!raw || typeof raw !== 'object') return value;
    for (const k of ['enabled', 'compact', 'contextMenu', 'autoLaunch', 'traktControls'])
      if (typeof raw[k] === 'boolean') value[k] = raw[k];
    if (['auto', 'labels', 'compact'].includes(raw.appearance))
      value.appearance = raw.appearance;
    else if (typeof raw.compact === 'boolean')
      value.appearance = raw.compact ? 'compact' : 'labels';
    value.compact = value.appearance === 'compact';
    if (['new', 'same'].includes(raw.linkTarget)) value.linkTarget = raw.linkTarget;
    for (const site of Object.keys(value.sites)) {
      if (typeof raw.sites?.[site] === 'boolean') value.sites[site] = raw.sites[site];
      for (const button of Object.keys(value.buttons[site]))
        if (typeof raw.buttons?.[site]?.[button] === 'boolean')
          value.buttons[site][button] = raw.buttons[site][button];
    }
    return value;
  }
  let value = copy(defaults),
    loaded = false,
    loadError = null;
  const listeners = new Set();
  const emit = () => {
    for (const listener of listeners) {
      try {
        listener(copy(value));
      } catch {}
    }
  };
  const storage = globalThis.NuvioSettingsStorage || globalThis.chrome?.storage?.local;
  let ready;
  if (storage) {
    ready = storage
      .get('nuvioSettings')
      .then((data) => {
        value = normalize(data.nuvioSettings);
      })
      .catch(() => {
        loadError = 'Settings could not be read. Default preferences are in use.';
        if (globalThis.NuvioSettingsStorage) {
          value.enabled = false;
          loadError = 'Settings could not be read. Reload the extension and this page.';
        }
      })
      .finally(() => {
        loaded = true;
        emit();
      });
  } else {
    loaded = true;
    ready = Promise.resolve();
  }
  const onChanged = (changes, area) => {
    if (area === 'local' && changes.nuvioSettings) {
      value = normalize(changes.nuvioSettings.newValue);
      emit();
    }
  };
  if (globalThis.NuvioSettingsStorage) NuvioSettingsStorage.subscribe(onChanged);
  else globalThis.chrome?.storage?.onChanged?.addListener(onChanged);
  async function save(next) {
    await ready;
    if (!storage) throw new Error('Chrome settings storage is unavailable.');
    const clean = normalize(next);
    await storage.set({ nuvioSettings: clean });
    value = clean;
    loadError = null;
    emit();
    return copy(value);
  }
  function visible(site) {
    return loaded && value.enabled && value.sites[site];
  }
  const adaptive = new WeakMap();
  function layout(site, host, shadow, count) {
    const bar = site === 'trakt' ? host.closest('.trakt-summary-actions-bar') : null;
    const parent = bar ? bar.parentElement : host.parentElement;
    let state = adaptive.get(host);
    if (!state) {
      state = { compact: false };
      adaptive.set(host, state);
    }
    if (value.appearance !== 'auto') {
      state.observer?.disconnect();
      state.parent = null;
      return value.appearance === 'compact';
    }
    if (parent !== state.parent) {
      state.observer?.disconnect();
      state.parent = parent;
      state.width = null;
      if (parent && typeof ResizeObserver !== 'undefined') {
        state.observer = new ResizeObserver((entries) => {
          const width = entries[0]?.contentRect.width;
          if (!host.isConnected || width === state.width) return;
          state.width = width;
          apply(site, host, shadow);
        });
        state.observer.observe(parent);
      }
    }
    let width = parent?.clientWidth || 0;
    if (width) {
      const css = getComputedStyle(parent);
      width -= parseFloat(css.paddingLeft) || 0;
      width -= parseFloat(css.paddingRight) || 0;
    }
    if (bar && width) {
      const css = getComputedStyle(bar);
      width -= (parseFloat(css.paddingLeft) || 0) + (parseFloat(css.paddingRight) || 0);
      const others = [...bar.children].filter(
        (e) => e !== host && getComputedStyle(e).display !== 'none',
      );
      width -= others.reduce((sum, e) => {
        const c = getComputedStyle(e);
        return (
          sum +
          e.getBoundingClientRect().width +
          (parseFloat(c.marginLeft) || 0) +
          (parseFloat(c.marginRight) || 0)
        );
      }, 0);
      width -= (parseFloat(css.columnGap) || 0) * others.length;
    }
    const needed = count * (site === 'trakt' ? 150 : 168) + Math.max(0, count - 1) * 8;
    // Stable parent width avoids shrink-wrapped button groups feeding back into sizing.
    if (width > 0) state.compact = width < needed + (state.compact ? 16 : 0);
    host.dataset.nuvioAppearance = state.compact ? 'compact' : 'labels';
    return state.compact;
  }
  function apply(site, host, shadow) {
    if (!host || !shadow) return;
    const links = [...shadow.querySelectorAll('a.nuvio,a.trakt,a.imdb')];
    let count = links.filter((link) => {
      const name = ['nuvio', 'trakt', 'imdb'].find((k) => link.classList.contains(k));
      return value.buttons[site]?.[name] && !link.hidden;
    }).length;
    const compact = layout(site, host, shadow, count);
    host.dataset.nuvioAppearance = compact ? 'compact' : 'labels';
    for (const link of links) {
      const name = ['nuvio', 'trakt', 'imdb'].find((k) => link.classList.contains(k));
      const show = Boolean(value.buttons[site]?.[name]);
      if (show) link.style.removeProperty('display');
      else link.style.setProperty('display', 'none', 'important');

      for (const label of link.querySelectorAll(
        ':scope > span:not([aria-hidden="true"])',
      ))
        label.style.display = compact ? 'none' : '';
      const compactSize = site === 'trakt' ? 'var(--ni-40,40px)' : '44px';
      for (const [key, val] of Object.entries({
        boxSizing: compact ? 'border-box' : '',
        padding: compact ? (site === 'trakt' ? 'var(--ni-6,6px)' : '0') : '',
        width: compact ? compactSize : '',
        height: compact ? compactSize : '',
        maxWidth: compact ? compactSize : '',
        maxHeight: compact ? compactSize : '',
        aspectRatio: compact ? '1 / 1' : '',
        minHeight: compact ? compactSize : '',
        minWidth: compact ? compactSize : '',
        gap: compact ? '0' : '',
        alignItems: compact ? 'center' : '',
        justifyContent: compact ? 'center' : '',
        flex: compact ? '0 0 ' + compactSize : '',
      })) {
        if (val) link.style[key] = val;
        else link.style[key] = '';
      }
      // Center the visible artwork, including the small inset in the Nuvio asset
      // and the font baseline inside the IMDb badge. Full-label mode is unchanged.
      const artwork = link.querySelector('img,.imdb-mark');
      if (artwork) {
        artwork.style.transform = compact
          ? name === 'nuvio'
            ? 'translateX(0.167px)'
            : name === 'imdb'
              ? 'translateY(-0.25px)'
              : ''
          : '';
        if (artwork.classList.contains('imdb-mark')) {
          artwork.style.display = compact ? 'flex' : '';
          artwork.style.alignItems = compact ? 'center' : '';
          artwork.style.justifyContent = compact ? 'center' : '';
        }
      }
      if (link.href?.startsWith('https:'))
        link.target = value.linkTarget === 'new' ? '_blank' : '_self';
      // Tooltips are set by each site adapter; compact mode must not duplicate their text.
    }
    for (const row of shadow.querySelectorAll('.actions,.row')) {
      row.style.display = compact ? 'flex' : '';
      row.style.flexWrap = compact ? 'wrap' : '';
    }
    const shown = Boolean(visible(site) && count);
    host.style.setProperty('display', shown ? 'block' : 'none', 'important');
    return shown;
  }
  globalThis.NuvioSettings = {
    defaults: copy(defaults),
    normalize,
    ready,
    get: () => copy(value),
    get loaded() {
      return loaded;
    },
    get loadError() {
      return loadError;
    },
    visible,
    apply,
    save,
    reset: () => save(defaults),
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
})();
