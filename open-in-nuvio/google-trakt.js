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
  function native(watch, labels) {
    const nodes = [...watch.querySelectorAll('span,div,button,a')].filter(
      (e) =>
        !e.closest('[data-nuvio-google],[data-nuvio-trakt-control]') &&
        labels.includes(e.textContent.trim()),
    );
    const controls = new Set(
      nodes
        .map((e) => e.closest('button,[role="button"],a') || e.closest('[jsaction]'))
        .filter((e) => e && watch.contains(e) && e !== watch),
    );
    return controls.size === 1 ? [...controls][0] : null;
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
    const watched = native(watch, ['Žiūrėta', 'Watched']),
      watchlist = native(watch, ['Noriu žiūrėti', 'Want to watch']);
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
        x.icon.textContent = x.action === 'watchlist' ? (selected ? '▣' : '▯') : '✓';
        x.button.title = ctx.state
          ? `${ctx.state.title} · Trakt · ${x.action === 'watchlist' ? (selected ? 'Remove from watchlist' : 'Add to watchlist') : selected ? 'Mark unwatched (remove all viewings)' : 'Mark watched now'}`
          : 'Connect Trakt in extension settings';
        x.button.disabled = ctx.loading;
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
      const host = document.createElement('span');
      host.dataset.nuvioTraktControl = '';
      host.style.cssText = 'display:inline-flex;vertical-align:top;';
      const root = host.attachShadow({ mode: 'closed' });
      root.innerHTML =
        '<style>*{box-sizing:border-box}button{display:flex;flex-direction:column;align-items:center;gap:9px;background:transparent;border:0;color:inherit;font:500 14px/1.2 Arial,sans-serif;cursor:pointer;padding:0 10px;min-width:90px}button:disabled{cursor:pointer}.circle{width:48px;height:48px;display:grid;place-items:center;border:1px solid #a98bbb;border-radius:50%;font-size:26px;color:#d6b3ec}button[aria-pressed=true] .circle{background:#653780;border-color:#d7a2f4}small{font:10px Arial;color:#ad85c3}button:focus-visible{outline:2px solid #c78fe8;outline-offset:4px}</style><button type="button" disabled><span class="circle"></span><span class="label"></span><small>Trakt</small></button>';
      const button = root.querySelector('button'),
        icon = root.querySelector('.circle');
      root.querySelector('.label').textContent =
        node.textContent.includes('Žiūrėta') || node.textContent.includes('Noriu žiūrėti')
          ? action === 'watched'
            ? 'Žiūrėta'
            : 'Noriu žiūrėti'
          : action === 'watched'
            ? 'Watched'
            : 'Want to watch';
      const display = node.style.display;
      node.before(host);
      node.style.display = 'none';
      const x = {
        host,
        node,
        display,
        button,
        icon,
        action,
        note: root.querySelector('small'),
      };
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
          x.icon.textContent = x.action === 'watched' ? '✓' : '▯';
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
