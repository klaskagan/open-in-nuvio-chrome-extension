const fs = require('fs'),
  vm = require('vm'),
  assert = require('assert'),
  { JSDOM } = require('jsdom');
const root = __dirname + '/../open-in-nuvio/';
let n = 0;
const check = (v, m) => {
  assert(v, m);
  n++;
  console.log('PASS ' + m);
};
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let clock = 0;
  let handler,
    calls = [],
    running = 0,
    max = 0,
    listed = false,
    watched = false;
  const account = {
    clientId: 'fixture',
    tokens: {
      access_token: 'fixture',
      refresh_token: 'fixture',
      created_at: Date.now() / 1000,
      expires_in: 3600,
    },
  };
  const chrome = {
    runtime: {
      id: 'x',
      getURL: (f) => 'chrome-extension://x/' + f,
      onMessage: { addListener: (f) => (handler = f) },
    },
    storage: { local: { get: async () => ({ nuvioTrakt: account }) } },
  };
  const ctx = vm.createContext({
    chrome,
    URL,
    URLSearchParams,
    Date: class extends Date {
      static now() {
        return Date.now() + clock;
      }
    },
    Promise,
    Map,
    Set,
    AbortSignal,
    NuvioSettings: {
      ready: Promise.resolve(),
      get: () => ({ enabled: true, traktControls: true, sites: { google: true } }),
    },
    NuvioGoogle: { googleHost: (h) => h === 'www.google.com' },
    fetch: async (url, o) => {
      calls.push(url);
      running++;
      max = Math.max(max, running);
      await delay(20);
      running--;
      let data;
      if (url.includes('/search/imdb/'))
        data = [
          {
            type: 'movie',
            movie: { title: 'Space Jam', ids: { trakt: 12, imdb: 'tt0117705' } },
          },
        ];
      else if (url.includes('/sync/watchlist'))
        data = listed ? [{ movie: { ids: { trakt: 12 } } }] : [];
      else data = watched ? [{ id: 1 }] : [];
      return { ok: true, json: async () => data, headers: { get: () => '1' } };
    },
  });
  vm.runInContext(fs.readFileSync(root + 'trakt-api.js', 'utf8'), ctx);
  const send = (trusted = false) =>
    new Promise((r) =>
      handler(
        { type: 'nuvio:trakt-state', id: 'tt0117705', kind: 'movie' },
        trusted
          ? { id: 'x', url: 'chrome-extension://x/trakt.html?id=tt0117705' }
          : { id: 'x', url: 'https://www.google.com/search?q=spacejam', frameId: 0 },
        r,
      ),
    );
  const [a, b] = await Promise.all([send(), send()]);
  check(
    a.title === b.title && calls.length === 3,
    'Concurrent cold status requests share three API requests',
  );
  check(max === 2, 'Watchlist and watched reads run in parallel');
  const before = calls.length;
  await send();
  check(
    calls.length === before,
    'Warm Google status uses 10-second memory cache with no API calls',
  );
  listed = true;
  await send(true);
  check(
    calls.length === before + 2,
    'Management reads fresh state while reusing exact title lookup',
  );
  check((await send()).watchlist, 'Fresh management state updates Google cache');
  clock = 11000;
  const expiredBefore = calls.length;
  await send();
  check(
    calls.length === expiredBefore + 2,
    'Status cache expires after 10 seconds without discarding stable title identity',
  );
  const dom = new JSDOM(
      '<div data-attrid="kc:/film/film:media_actions_wholepage"><button>Žiūrėta</button><button>Noriu žiūrėti</button></div>',
      { url: 'https://www.google.com/search?q=spacejam', runScripts: 'outside-only' },
    ),
    w = dom.window,
    roots = [];
  const attach = w.Element.prototype.attachShadow;
  w.Element.prototype.attachShadow = function (o) {
    const s = attach.call(this, o);
    roots.push(s);
    return s;
  };
  let reply,
    messages = [],
    listener;
  w.NuvioSettings = {
    get: () => ({ enabled: true, traktControls: true, sites: { google: true } }),
  };
  w.chrome = {
    runtime: {
      id: 'x',
      onMessage: { addListener: (f) => (listener = f) },
      sendMessage: (m) => {
        messages.push(m);
        return m.type.endsWith('state')
          ? Promise.resolve({ title: 'Space Jam', watched: false, watchlist: false })
          : new Promise((r) => (reply = r));
      },
    },
  };
  w.eval(fs.readFileSync(root + 'google-trakt.js', 'utf8'));
  const info = {
    id: 'tt0117705',
    kind: 'movie',
    key: 'a',
    target: w.document.querySelector('div'),
    valid: () => true,
  };
  await w.NuvioGoogleTrakt.sync(info);
  const watchedButton = roots[0].querySelector('button'),
    listButton = roots[1].querySelector('button'),
    hosts = [...info.target.querySelectorAll('[data-nuvio-trakt-control]')];
  let task = listButton.onclick();
  check(
    listButton.getAttribute('aria-pressed') === 'true',
    'Watchlist toggles before response',
  );
  check(
    !listButton.disabled && !watchedButton.disabled,
    'Both controls remain clickable during saves',
  );
  check(roots[1].querySelector('small').textContent === 'Trakt', 'No saving text');
  const second = watchedButton.onclick();
  check(
    watchedButton.getAttribute('aria-pressed') === 'true',
    'Second control toggles while first request is pending',
  );
  check(messages.length === 2, 'Writes are serialized without delaying optimistic UI');
  reply({ title: 'Space Jam', watched: false, watchlist: true });
  await task;
  check(
    watchedButton.getAttribute('aria-pressed') === 'true',
    'First response cannot overwrite second pending intent',
  );
  check(
    messages.at(-1).action === 'watched',
    'Second write starts after first acknowledgement',
  );
  reply({ title: 'Space Jam', watched: true, watchlist: false });
  await second;
  check(
    watchedButton.getAttribute('aria-pressed') === 'true' &&
      listButton.getAttribute('aria-pressed') === 'false',
    'Server watched side effect reconciled',
  );
  const off = watchedButton.onclick(),
    on = watchedButton.onclick();
  check(
    watchedButton.getAttribute('aria-pressed') === 'true',
    'Rapid double click immediately shows latest intent',
  );
  reply({ title: 'Space Jam', watched: false, watchlist: false });
  await off;
  check(
    watchedButton.getAttribute('aria-pressed') === 'true',
    'Earlier unwatch reply cannot flicker latest watched intent',
  );
  reply({ title: 'Space Jam', watched: true, watchlist: false });
  await on;
  task = listButton.onclick();
  const later = watchedButton.onclick();
  reply({ error: 'Simulated failure' });
  await task;
  check(
    listButton.getAttribute('aria-pressed') === 'false' &&
      watchedButton.getAttribute('aria-pressed') === 'false',
    'Failure rolls back only failed operation while later intent stays visible',
  );
  reply({ title: 'Space Jam', watched: false, watchlist: false });
  await later;
  const count = messages.length;
  w.dispatchEvent(new w.Event('focus'));
  w.document.dispatchEvent(new w.Event('visibilitychange'));
  await delay(10);
  check(
    messages.length === count && hosts.every((h) => h.isConnected),
    'Focus neither requests nor remounts controls',
  );
  listener(
    {
      type: 'nuvio:trakt-state-changed',
      id: info.id,
      kind: info.kind,
      state: { title: 'Space Jam', watched: false, watchlist: true },
    },
    { id: 'x' },
  );
  check(
    listButton.getAttribute('aria-pressed') === 'true',
    'Pushed account updates still reconcile idle controls',
  );
  task = listButton.onclick();
  w.NuvioGoogleTrakt.clear();
  reply({ title: 'Space Jam', watched: false, watchlist: false });
  await task;
  check(
    !info.target.querySelector('[data-nuvio-trakt-control]'),
    'Late reply does not remount controls',
  );
  dom.window.close();
  console.log('TOTAL ' + n + ' Trakt performance checks passed');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
