(() => {
  let active = null,
    revision = 0;
  const watchSelector =
    '[data-attrid$=":media_actions_wholepage"], [data-attrid$=":media_actions"]';
  function clear() {
    globalThis.NuvioSeriesConfirm?.cancel();
    revision++;
    if (active) {
      for (const x of active.items) {
        x.host.remove();
        if (x.node.style.display === 'none') x.node.style.display = x.display;
      }
      active = null;
    }
  }
  // Google localizes labels, but these action markers and SVG shapes are shared.
  // Never infer the action from column order: provider links and RTL layouts vary.
  function native(watch, action) {
    const selector =
      action === 'watched'
        ? '#lbaHdc,[jscontroller="I5Flqd"]'
        : '#NXD9g,[jscontroller="TdUNyc"],[jsname="cJyZJd"][aria-pressed]';
    const eligible = (node) =>
      !node.closest('[data-nuvio-google],[data-nuvio-trakt-control]');
    let nodes = [...watch.querySelectorAll(selector)].filter(eligible);
    if (!nodes.length) {
      const paths =
        action === 'watched'
          ? ['M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z']
          : [
              'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z',
              'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z',
            ];
      nodes = [...watch.querySelectorAll('button,[role="button"],[role="checkbox"]')]
        .filter(eligible)
        .filter((node) =>
          [...node.querySelectorAll('svg path')].some((path) =>
            paths.includes(path.getAttribute('d')),
          ),
        );
    }
    nodes = [...new Set(nodes)];
    return nodes.length === 1 ? nodes[0] : null;
  }
  function localizedLabels(node) {
    const label = node.querySelector('.QuU3Wb');
    const unselected = label?.querySelector('.ad7nsf');
    const selected = label?.querySelector('.hg5Jzc');
    const text = (element) => element?.textContent.trim().replace(/\s+/g, ' ');
    const fallback =
      text(label) ||
      node.getAttribute('aria-label')?.trim() ||
      text(node.querySelector('span:last-child')) ||
      text(node);
    return {
      unselected: text(unselected) || fallback,
      selected: text(selected) || fallback,
    };
  }
  function replacement(node, action, watch) {
    // Keep Google's flex/grid slot, presentation classes, dimensions and text.
    // Remove all Google behavior and IDs; only Trakt handles this clone's events.
    const host = node.cloneNode(true);
    host
      .querySelectorAll('g-snackbar,[role="dialog"],script,style')
      .forEach((x) => x.remove());
    const visual = host.querySelector('[jsname="Q6Aqdc"]');
    if (visual) host.replaceChildren(visual);
    for (const element of [host, ...host.querySelectorAll('*')]) {
      for (const attr of [...element.attributes]) {
        if (
          /^(?:id$|js|data-|on|href$|ping$|aria-(?:labelledby|describedby|controls)$)/i.test(
            attr.name,
          )
        )
          element.removeAttribute(attr.name);
      }
    }
    host.dataset.nuvioTraktControl = action;
    host.setAttribute('role', 'button');
    host.setAttribute('tabindex', '0');
    host.style.cursor = 'pointer';
    let icon = host.querySelector('.niO4u');
    if (!icon) {
      icon = document.createElement('span');
      host.prepend(icon);
    }
    icon.classList.add('nuvio-trakt-icon');
    icon.setAttribute('aria-hidden', 'true');
    let label = host.querySelector('.QuU3Wb');
    if (!label) {
      label = document.createElement('span');
      host.replaceChildren(icon, label);
    }
    label.classList.add('nuvio-trakt-label');
    // Match the provider subtitle's typography and spacing; retain Trakt purple.
    const note = document.createElement('small');
    const subtitle = watch.querySelector('.Z4yf9b .ZYHQ7e, .tcS2Xc .ZYHQ7e');
    if (subtitle) {
      note.className = subtitle.className;
      const style = getComputedStyle(subtitle);
      for (const property of [
        'font-family',
        'font-size',
        'font-weight',
        'font-style',
        'line-height',
        'margin-top',
        'margin-bottom',
        'padding-top',
        'padding-bottom',
      ])
        note.style.setProperty(property, style.getPropertyValue(property));
    } else {
      note.style.cssText =
        'display:block;font:12px/16px Arial,sans-serif;margin:0;padding:0';
    }
    note.style.display = 'block';
    note.style.color = '#ad85c3';
    label.after(note);
    const stop = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    host.addEventListener(
      'click',
      (event) => {
        stop(event);
        void host.onclick?.(event);
      },
      true,
    );
    host.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          stop(event);
          if (event.key === 'Enter' && !event.repeat) void host.onclick?.(event);
        }
      },
      true,
    );
    host.addEventListener(
      'keyup',
      (event) => {
        if (event.key === ' ') {
          stop(event);
          void host.onclick?.(event);
        }
      },
      true,
    );
    for (const type of [
      'pointerdown',
      'pointerup',
      'mousedown',
      'mouseup',
      'touchstart',
      'touchend',
      'dblclick',
      'auxclick',
    ])
      host.addEventListener(type, (event) => event.stopPropagation(), true);
    return { host, button: host, icon, label, note, labels: localizedLabels(node) };
  }
  function drawIcon(icon, action, selected) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute(
      'd',
      action === 'watched'
        ? 'M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z'
        : selected
          ? 'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z'
          : 'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z',
    );
    svg.append(path);
    icon.replaceChildren(svg);
    // Accent only; all sizing, alignment, margins and padding stay native.
    icon.style.color = '#c58be2';
    icon.style.borderColor = '#a98bbb';
    icon.style.backgroundColor = selected ? '#653780' : 'transparent';
  }
  async function sync(info) {
    const prefs = NuvioSettings.get();
    if (!info || !prefs.enabled || !prefs.sites.google || !prefs.traktControls) {
      clear();
      return;
    }
    const watch = info.target.matches(watchSelector) ? info.target : null;
    if (!watch) {
      clear();
      return;
    }
    const watched = native(watch, 'watched'),
      watchlist = native(watch, 'watchlist');
    if (
      active?.key === info.key &&
      active.items.every((x) => x.node.isConnected && x.host.isConnected)
    )
      return;
    clear();
    if (!watched || !watchlist || watched === watchlist) return;
    const rev = revision;
    const ctx = {
      ...info,
      items: [],
      key: info.key,
      state: null,
      confirmed: null,
      operations: [],
      running: false,
      loading: true,
    };
    active = ctx;
    const send = async (type, extra = {}) => {
      const r = await chrome.runtime.sendMessage({
        type: 'nuvio:trakt-' + type,
        id: info.id,
        kind: info.kind,
        ...extra,
      });
      if (!r || r.error) throw Error(r?.error || 'Trakt unavailable');
      return r;
    };
    const valid = () => active === ctx && revision === rev && info.valid();
    const manage = () => send('manage');
    function paint() {
      for (const x of ctx.items) {
        const selected =
          ctx.state &&
          (x.action === 'watchlist' ? ctx.state.watchlist : ctx.state.watched);
        x.button.setAttribute('aria-pressed', String(Boolean(selected)));
        drawIcon(x.icon, x.action, selected);
        x.label.textContent = selected ? x.labels.selected : x.labels.unselected;
        x.button.setAttribute('aria-label', x.label.textContent + ' · Trakt');
        x.button.title = ctx.state
          ? `${ctx.state.title} · Trakt · ${x.action === 'watchlist' ? (selected ? 'Remove from watchlist' : 'Add to watchlist') : selected ? 'Mark unwatched (remove all viewings)' : 'Mark watched now'}`
          : 'Connect Trakt in extension settings';
        x.button.disabled = ctx.loading;
        x.button.setAttribute('aria-disabled', String(ctx.loading));
        x.button.setAttribute(
          'aria-busy',
          String(ctx.operations.some((op) => op.action === x.action)),
        );
        x.note.textContent = 'Trakt';
      }
    }
    function optimistic() {
      ctx.state = { ...ctx.confirmed };
      for (const op of ctx.operations) {
        ctx.state[op.action] = op.desired;
        if (op.action === 'watched' && op.desired) ctx.state.watchlist = false;
      }
      if (valid()) paint();
    }
    async function drain() {
      if (ctx.running) return;
      ctx.running = true;
      while (ctx.operations.length) {
        const op = ctx.operations[0];
        let failure;
        try {
          const result = await send('update', {
            action: op.action,
            desired: op.desired,
            ...(op.planToken ? { planToken: op.planToken } : {}),
          });
          ctx.confirmed = { ...ctx.confirmed, ...result, [op.action]: op.desired };
        } catch (error) {
          failure = error;
        }
        ctx.operations.shift();
        optimistic();
        if (failure && valid()) {
          const item = ctx.items.find((x) => x.action === op.action);
          item.button.title = failure.message;
          item.note.textContent = 'Failed · retry';
        }
        op.resolve();
      }
      ctx.running = false;
    }
    for (const [node, action] of [
      [watched, 'watched'],
      [watchlist, 'watchlist'],
    ]) {
      const control = replacement(node, action, watch);
      const { host, button } = control;
      const display = node.style.display;
      node.before(host);
      node.style.display = 'none';
      const x = { ...control, node, display, action };
      ctx.items.push(x);
      button.onclick = async () => {
        if (!valid() || ctx.loading) return;
        if (!ctx.state) {
          if (button.disabled) return;
          button.disabled = true;
          try {
            await manage();
          } catch (e) {
            button.title = e.message;
            x.note.textContent = 'Retry · Trakt';
          } finally {
            if (valid()) button.disabled = false;
          }
          return;
        }
        const desired = !ctx.state[action];
        let planToken;
        if (action === 'watched' && info.kind === 'series') {
          if (ctx.confirming) return;
          ctx.confirming = true;
          try {
            const plan = await send('series-plan', { desired });
            if (!valid() || !plan.count) return;
            if (!(await NuvioSeriesConfirm.ask(plan, desired, valid))) return;
            planToken = plan.token;
          } catch (e) {
            if (valid()) {
              button.title = e.message;
              x.note.textContent = 'Failed · retry';
            }
            return;
          } finally {
            ctx.confirming = false;
          }
        }
        return new Promise((resolve) => {
          ctx.operations.push({ action, desired, planToken, resolve });
          optimistic();
          drain();
        });
      };
    }
    ctx.receive = (value) => {
      if (valid() && !ctx.operations.length) {
        ctx.confirmed = { ...ctx.confirmed, ...value };
        ctx.state = ctx.confirmed;
        paint();
      }
    };
    paint();
    try {
      ctx.confirmed = await send('state');
      ctx.state = ctx.confirmed;
      ctx.loading = false;
      if (valid()) paint();
    } catch (e) {
      if (valid()) {
        ctx.loading = false;
        paint();
        for (const x of ctx.items) {
          x.button.title = e.message + ' · Click to connect or manage Trakt';
          drawIcon(x.icon, x.action, false);
        }
      }
    }
  }

  // Account writes publish fresh state; changing window focus never reloads the controls.
  chrome.runtime.onMessage?.addListener((message, sender) => {
    if (
      sender.id === chrome.runtime.id &&
      message?.type === 'nuvio:trakt-state-changed' &&
      active?.id === message.id &&
      active?.kind === message.kind
    )
      active.receive?.(message.state);
  });
  globalThis.NuvioGoogleTrakt = { sync, clear };
})();
