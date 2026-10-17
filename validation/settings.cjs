const fs = require('fs'),
  path = require('path'),
  vm = require('vm'),
  assert = require('assert');
const { JSDOM } = require('jsdom');
const base = path.join(__dirname, '../open-in-nuvio/');
let n = 0;
const check = (v, m) => {
  assert(v, m);
  n++;
  console.log('PASS ' + m);
};
const wait = (ms = 130) => new Promise((r) => setTimeout(r, ms));
function storage(initial) {
  const state = {
    value: initial,
    other: 'preserved',
    listeners: [],
    writes: [],
    fail: false,
  };
  state.api = {
    local: {
      get: async () => ({ nuvioSettings: state.value }),
      set: async (data) => {
        if (state.fail) throw new Error('Storage failed');
        const old = state.value;
        state.value = JSON.parse(JSON.stringify(data.nuvioSettings));
        state.writes.push(data);
        state.listeners.forEach((f) =>
          f({ nuvioSettings: { oldValue: old, newValue: state.value } }, 'local'),
        );
      },
    },
    onChanged: { addListener: (f) => state.listeners.push(f) },
  };
  state.change = (value) => {
    state.value = value;
    state.listeners.forEach((f) => f({ nuvioSettings: { newValue: value } }, 'local'));
  };
  return state;
}
function dom(html, url, store) {
  const d = new JSDOM(html, { url, runScripts: 'outside-only' });
  d.window.chrome = {
    storage: store.api,
    runtime: {
      getManifest: () => ({ version: '1.4.0' }),
      sendMessage: async () => ({ identity: { provider: 'imdb', id: 'tt0117705' } }),
    },
  };
  const attach = d.window.Element.prototype.attachShadow;
  d.window.Element.prototype.attachShadow = function (o) {
    const s = attach.call(this, o);
    d.window.ui = s;
    return s;
  };
  return d;
}
function load(w, ...files) {
  for (const f of files) w.eval(fs.readFileSync(base + f, 'utf8'));
}
(async () => {
  const store = storage();
  const d = dom('', 'https://www.google.com/search?q=spacejam', store);
  load(d.window, 'settings.js');
  const S = d.window.NuvioSettings;
  await S.ready;
  check(
    S.get().enabled && S.get().autoLaunch && S.get().contextMenu,
    'Defaults preserve enabled extension and right-click behaviour',
  );
  check(
    S.get().linkTarget === 'new' && !S.get().compact,
    'Default links and labels preserve prior behaviour',
  );
  const copy = S.get();
  copy.enabled = false;
  check(S.get().enabled, 'Returned settings cannot mutate internal state');
  const invalid = S.normalize({
    enabled: 'false',
    compact: 1,
    linkTarget: 'javascript',
    unknown: true,
    sites: { google: false },
    buttons: { google: { nuvio: false, unknown: true } },
  });
  check(
    invalid.enabled && !invalid.compact && invalid.linkTarget === 'new',
    'Invalid setting types use safe defaults',
  );
  check(
    !invalid.sites.google &&
      !invalid.buttons.google.nuvio &&
      invalid.buttons.google.trakt,
    'Partial settings preserve explicit false and default missing fields',
  );
  check(
    !('unknown' in invalid) && !('unknown' in invalid.buttons.google),
    'Unknown stored fields are discarded',
  );
  await S.save(invalid);
  check(
    store.value.sites.google === false && store.writes.length === 1,
    'Preferences persist to Chrome local storage',
  );
  const reread = dom('', 'https://www.imdb.com/title/tt0117705/', store);
  load(reread.window, 'settings.js');
  await reread.window.NuvioSettings.ready;
  check(
    !reread.window.NuvioSettings.get().sites.google,
    'Preferences restored in another extension context',
  );
  store.fail = true;
  let failed = false;
  try {
    await S.reset();
  } catch {
    failed = true;
  }
  check(
    failed && !S.get().sites.google,
    'Storage failures reject without claiming successful changes',
  );
  store.fail = false;
  await S.reset();
  check(
    S.get().sites.google && S.get().buttons.google.nuvio,
    'Reset restores the original defaults',
  );
  check(
    store.other === 'preserved' &&
      store.writes.every((w) => Object.keys(w).join() === 'nuvioSettings'),
    'Reset writes only the extension preference key',
  );
  check(!S.get().traktControls, 'Trakt controls default to off');
  await S.save({ ...S.get(), traktControls: true });
  check(store.value.traktControls, 'Trakt control preference persists locally');
  await S.reset();
  d.window.close();
  reread.window.close();
  // Deferred preference loading: disabled Google UI must never flash or resolve redirects.
  const gstore = storage({ sites: { google: false } });
  let finish;
  gstore.api.local.get = () => new Promise((r) => (finish = r));
  const g = dom(
    '<body><div data-attrid="title">Space Jam</div><div data-md="17"><a href="https://www.imdb.com/title/tt0117705/">IMDb 6.5</a></div><div data-attrid="kc:/film/film:media_actions_wholepage"></div>',
    'https://www.google.com/search?q=spacejam',
    gstore,
  );
  load(g.window, 'settings.js', 'button-icon.js', 'google-core.js', 'google.js');
  const widget = () => g.window.document.querySelector('[data-nuvio-google]');
  check(!widget(), 'Google buttons absent before saved settings finish loading');
  finish({ nuvioSettings: gstore.value });
  await wait();
  check(!widget(), 'Disabled Google site remains hidden after load');
  gstore.change({});
  await wait();
  check(Boolean(widget()), 'Enabling Google shows buttons on the existing page');
  const config = g.window.NuvioSettings.get();
  config.buttons.google.nuvio = false;
  config.linkTarget = 'same';
  config.appearance = 'compact';
  config.compact = true;
  gstore.change(config);
  await wait();
  const link = (c) => g.window.ui.querySelector(c);
  check(
    link('.nuvio').style.display === 'none' && link('.trakt').style.display !== 'none',
    'Per-destination controls hide only the requested button',
  );
  check(
    link('.trakt').target === '_self' && link('.imdb').target === '_self',
    'Same-tab preference applies to both website links',
  );
  check(
    link('.trakt').querySelector('span').style.display === 'none',
    'Compact mode hides button text',
  );
  check(
    link('.trakt').getAttribute('aria-label') === 'Open in Trakt' &&
      link('.trakt').title === 'Open Space Jam in Trakt',
    'Compact mode preserves accessible name and tooltip',
  );
  config.appearance = 'labels';
  config.compact = false;
  config.linkTarget = 'new';
  gstore.change(config);
  await wait();
  check(
    link('.trakt').querySelector('span').style.display === '' &&
      link('.trakt').target === '_blank',
    'Normal labels and new tabs restore live',
  );
  config.buttons.google.trakt = false;
  config.buttons.google.imdb = false;
  gstore.change(config);
  await wait();
  check(
    widget().style.display === 'none',
    'All destinations off hides the entire button group',
  );
  config.enabled = false;
  gstore.change(config);
  await wait();
  check(!widget(), 'Master pause removes Google buttons');
  gstore.change({});
  await wait();
  check(Boolean(widget()), 'Master resume restores current-page buttons');
  g.window.close();
  // Popup controls save on change and survive reopening.
  const pstore = storage();
  const popupHTML = fs.readFileSync(base + 'popup.html', 'utf8');
  const p = dom(popupHTML, 'https://extension.test/popup.html', pstore);
  load(p.window, 'button-icon.js', 'settings.js', 'popup.js');
  await wait();
  const doc = p.window.document;
  check(
    !doc.getElementById('fields').disabled && doc.getElementById('enabled').checked,
    'Popup loads saved defaults and enables controls',
  );
  const toggle = (selector, value) => {
    const el = doc.querySelector(selector);
    if (el.type === 'checkbox') el.checked = value;
    else el.value = value;
    el.dispatchEvent(new p.window.Event('change', { bubbles: true }));
  };
  toggle('[data-site="google"]', false);
  toggle('[data-site-button="imdb.trakt"]', false);
  toggle('#appearance', 'compact');
  toggle('#linkTarget', 'same');
  toggle('#contextMenu', false);
  toggle('#autoLaunch', false);
  await wait();
  check(
    pstore.value.sites.google === false && pstore.value.buttons.imdb.trakt === false,
    'Popup persists site and destination switches',
  );
  check(
    pstore.value.compact &&
      pstore.value.linkTarget === 'same' &&
      !pstore.value.contextMenu &&
      !pstore.value.autoLaunch,
    'Popup persists all global display/navigation/launch options',
  );
  check(
    doc.getElementById('status').textContent === 'Saved',
    'Popup confirms completed saves',
  );
  const p2 = dom(popupHTML, 'https://extension.test/popup.html', pstore);
  load(p2.window, 'button-icon.js', 'settings.js', 'popup.js');
  await wait();
  check(
    !p2.window.document.querySelector('[data-site="google"]').checked &&
      p2.window.document.getElementById('appearance').value === 'compact',
    'Reopened popup restores saved controls',
  );
  p2.window.close();
  pstore.fail = true;
  toggle('#appearance', 'labels');
  await wait();
  check(
    doc.getElementById('status').classList.contains('error'),
    'Popup reports storage failure instead of Saved',
  );
  pstore.fail = false;
  doc.getElementById('reset').click();
  await wait();
  check(
    doc.getElementById('appearance').value === 'auto' &&
      doc.querySelector('[data-site="google"]').checked &&
      pstore.value.autoLaunch,
    'Reset updates both saved preferences and popup controls',
  );
  p.window.close();
  // Background: a sleeping worker must wait for preferences rather than discard the first menu click.
  const bstore = storage();
  let release;
  bstore.api.local.get = () => new Promise((r) => (release = r));
  let clicked, install;
  const menus = [],
    created = [];
  const handlers = [];
  const chrome = {
    storage: bstore.api,
    runtime: {
      id: 'test',
      getURL: (f) => 'chrome-extension://test/' + f,
      onMessage: { addListener: (f) => handlers.push(f) },
      onInstalled: { addListener: (f) => (install = f) },
      onStartup: { addListener: () => {} },
    },
    contextMenus: {
      removeAll: (cb) => {
        menus.length = 0;
        cb();
      },
      create: (o, cb) => {
        menus.push(o);
        cb?.();
      },
      onClicked: { addListener: (f) => (clicked = f) },
    },
    tabs: {
      create: async (o) => {
        created.push(o);
        return { id: 5, ...o };
      },
      onRemoved: { addListener: () => {} },
    },
  };
  const ctx = vm.createContext({
    chrome,
    URL,
    URLSearchParams,
    Map,
    Date,
    Promise,
    AbortSignal,
    setTimeout,
    clearTimeout,
    location: { href: 'chrome-extension://test/background.js' },
    fetch: async () => {
      throw new Error('Unexpected fetch');
    },
  });
  ctx.importScripts = (...files) =>
    files.forEach((f) => vm.runInContext(fs.readFileSync(base + f, 'utf8'), ctx));
  vm.runInContext(fs.readFileSync(base + 'background.js', 'utf8'), ctx);
  const click = clicked({
    menuItemId: 'nuvio-movie',
    linkUrl: 'https://www.imdb.com/title/tt0117705/',
  });
  check(created.length === 0, 'Cold worker holds menu click while preferences load');
  release({});
  await click;
  check(
    created.length === 1,
    'Cold worker completes the first click after loading preferences',
  );
  install();
  check(menus.length === 4, 'Enabled preference registers right-click menu');
  bstore.change({ contextMenu: false });
  check(
    menus.length === 0,
    'Disabling right-click shortcut removes native menu items live',
  );
  await clicked({
    menuItemId: 'nuvio-movie',
    linkUrl: 'https://www.imdb.com/title/tt0117705/',
  });
  check(created.length === 1, 'Disabled right-click action cannot open launcher');
  bstore.change({ enabled: false });
  check(menus.length === 0, 'Master pause removes right-click menu');
  bstore.change({});
  check(menus.length === 4, 'Restoring defaults recreates right-click menu');
  // Trakt pause affects UI, not identity reporting required for explicit right-click lookups.
  const tstore = storage({ enabled: false });
  const t = dom(
    '<body><div class="trakt-summary-actions-bar"></div>',
    'https://app.trakt.tv/movies/space-jam-1996',
    tstore,
  );
  const reports = [];
  t.window.chrome.runtime.sendMessage = async (m) => reports.push(m);
  load(t.window, 'settings.js', 'button-icon.js', 'core.js', 'content.js');
  await wait();
  t.window.dispatchEvent(
    new t.window.CustomEvent('nuvio:metadata', {
      detail: JSON.stringify({
        key: 'movies/space-jam-1996',
        id: '2300',
        imdb: 'tt0117705',
      }),
    }),
  );
  check(
    !t.window.document.querySelector('[data-nuvio]') ||
      t.window.document.querySelector('[data-nuvio]').style.display === 'none',
    'Trakt buttons respect saved master pause',
  );
  tstore.change({ compact: true, linkTarget: 'same' });
  await wait();
  check(
    t.window.document.querySelector('[data-nuvio]').style.display === 'block' &&
      t.window.ui.querySelector('.imdb').target === '_self',
    'Trakt resumes with saved compact/same-tab preferences',
  );
  t.window.close();
  console.log('TOTAL ' + n + ' settings, popup and live-application checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
