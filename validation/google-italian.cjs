const fs = require('node:fs');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
(async () => {
  const root = __dirname + '/../open-in-nuvio/';
  const dom = new JSDOM(
    fs.readFileSync(__dirname + '/fixtures/google-native-it.html', 'utf8'),
    {
      url: 'https://www.google.com/search?q=interstellar&hl=it&gl=it',
      runScripts: 'outside-only',
    },
  );
  const w = dom.window,
    roots = [];
  const attach = w.Element.prototype.attachShadow;
  w.Element.prototype.attachShadow = function (options) {
    const root = attach.call(this, options);
    roots.push(root);
    return root;
  };
  const messages = [];
  w.NuvioSettings = {
    get: () => ({ enabled: true, sites: { google: true }, traktControls: true }),
    visible: () => true,
    apply() {},
    subscribe() {},
  };
  w.chrome = {
    runtime: {
      id: 'test',
      onMessage: { addListener() {} },
      sendMessage: async (m) => {
        messages.push(m);
        return { title: 'Interstellar', watched: true, watchlist: false };
      },
    },
  };
  for (const file of ['button-icon.js', 'google-core.js', 'google-trakt.js', 'google.js'])
    w.eval(fs.readFileSync(root + file, 'utf8'));
  await new Promise((resolve) => setTimeout(resolve, 180));
  const widget = w.document.querySelector('[data-nuvio-google]');
  assert(widget, 'Italian results mount navigation buttons');
  const shadow = roots.find((r) => r.host === widget);
  assert.equal(
    shadow.querySelector('.nuvio').getAttribute('href'),
    'nuvio://imdb/movie/tt0816692',
  );
  const watched = w.document.querySelector('[data-nuvio-trakt-control=watched]');
  const watchlist = w.document.querySelector('[data-nuvio-trakt-control=watchlist]');
  assert(watched && watchlist, 'Both Italian native controls replaced');
  assert.equal(watched.getAttribute('aria-pressed'), 'true');
  assert.equal(
    watchlist.querySelector('.nuvio-trakt-label').textContent,
    'Voglio guardare',
  );
  assert(messages.some((m) => m.type === 'nuvio:trakt-state' && m.id === 'tt0816692'));
  assert(
    !messages.some((m) => m.type === 'nuvio:trakt-identify'),
    'Exact locale-prefixed rating link avoids title search',
  );
  w.close();
  console.log('TOTAL 7 Italian Google page checks passed');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
