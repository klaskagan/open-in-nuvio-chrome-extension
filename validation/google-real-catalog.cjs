const fs = require('fs'),
  vm = require('vm'),
  assert = require('assert'),
  { JSDOM } = require('jsdom');
const root = __dirname + '/../open-in-nuvio/',
  fixtures = __dirname + '/fixtures/';
let n = 0;
const check = (v, m) => {
  assert(v, m);
  console.log('PASS ' + m);
  n++;
};
const data = (f) => JSON.parse(fs.readFileSync(fixtures + f, 'utf8'));
const samples = data('carousel-snapshots.json');
const sleep = () => new Promise((r) => setTimeout(r, 250));
(async () => {
  let handle,
    paths = [],
    wrongDirector = false;
  const chrome = {
    runtime: {
      id: 'test',
      getURL: (f) => 'chrome-extension://test/' + f,
      onMessage: { addListener: (f) => (handle = f) },
    },
    storage: {
      local: {
        get: async () => ({
          nuvioTrakt: {
            clientId: 'fixture',
            tokens: {
              access_token: 'fixture',
              refresh_token: 'fixture',
              created_at: Date.now() / 1000,
              expires_in: 3600,
            },
          },
        }),
      },
    },
  };
  const context = vm.createContext({
    chrome,
    URL,
    URLSearchParams,
    Date,
    Promise,
    Map,
    Set,
    AbortSignal,
    NuvioSettings: {
      ready: Promise.resolve(),
      get: () => ({ enabled: true, traktControls: true, sites: { google: true } }),
    },
    NuvioGoogle: { googleHost: () => true },
    fetch: async (url) => {
      paths.push(url);
      let rows;
      const u = new URL(url);
      if (u.pathname.endsWith('/people')) {
        rows = wrongDirector
          ? {
              crew: {
                directing: [{ job: 'Director', person: { name: 'Wrong Person' } }],
              },
            }
          : data('couture-people.json');
      } else {
        const q = u.searchParams.get('query');
        rows = /Couture|Mados/i.test(q)
          ? data('couture-search.json')
          : /^2004$/.test(q)
            ? data('numeric-year-search.json')
            : data('shark-search.json');
      }
      return { ok: true, json: async () => rows, headers: { get: () => '1' } };
    },
  });
  vm.runInContext(fs.readFileSync(root + 'trakt-api.js', 'utf8'), context);
  const send = (m) =>
    new Promise((r) =>
      handle(
        m,
        { id: 'test', url: 'https://www.google.com/search?q=film', frameId: 0 },
        r,
      ),
    );
  for (const sample of samples) {
    const html =
      '<div data-attrid="title">' +
      sample.title +
      '</div><div data-attrid="subtitle">' +
      sample.subtitle +
      '</div><div data-attrid="description"><span>' +
      sample.description +
      '</span></div><div data-attrid="VisualDigestWebResult">' +
      sample.digest +
      '</div><div data-attrid="kc:/film/film:director">' +
      sample.directors.map((d) => '<a>' + d + '</a>').join('') +
      '</div><div data-attrid="kc:/film/film:media_actions_wholepage"></div>';
    const doc = new JSDOM(html, {
      url: 'https://www.google.com/search?q=' + encodeURIComponent(sample.title),
      runScripts: 'outside-only',
    });
    let evidence, shadow;
    const original = doc.window.Element.prototype.attachShadow;
    doc.window.Element.prototype.attachShadow = function (o) {
      shadow = original.call(this, o);
      return shadow;
    };
    doc.window.chrome = {
      runtime: {
        sendMessage: (m) => {
          evidence = m;
          return send(m);
        },
      },
    };
    for (const f of ['settings.js', 'button-icon.js', 'google-core.js', 'google.js'])
      doc.window.eval(fs.readFileSync(root + f, 'utf8'));
    await sleep();
    check(
      evidence.titles.every((t) => /\p{L}/u.test(t)),
      'Numeric year is not sent as a title alias: ' + sample.title,
    );
    check(
      shadow?.querySelector('.imdb').href ===
        'https://www.imdb.com/title/' + sample.id + '/',
      'Real catalog lookup resolves ' + sample.title,
    );
    doc.window.close();
  }
  const failed = new JSDOM(
    '<div data-attrid="title">Couture</div><div data-attrid="subtitle">2025</div><div data-attrid="kc:/film/film:media_actions_wholepage"></div>',
    { url: 'https://www.google.com/search?q=couture', runScripts: 'outside-only' },
  );
  let attempts = 0;
  failed.window.chrome = {
    runtime: {
      sendMessage: async () =>
        ++attempts === 1
          ? { error: 'Simulated lookup problem' }
          : { identity: { provider: 'imdb', id: 'tt34688195' } },
    },
  };
  for (const f of ['settings.js', 'button-icon.js', 'google-core.js', 'google.js'])
    failed.window.eval(fs.readFileSync(root + f, 'utf8'));
  await sleep();
  check(
    failed.window.document
      .querySelector('[data-nuvio-google-status]')
      ?.textContent.includes('Simulated lookup problem'),
    'Lookup failures display an inline explanation',
  );
  await sleep();
  check(attempts === 1, 'Failure state does not loop network retries');
  failed.window.document.querySelector('[data-nuvio-google-status] button').click();
  await sleep();
  check(
    attempts === 2 && failed.window.document.querySelector('[data-nuvio-google]'),
    'Retry recovers title lookup',
  );
  check(
    !failed.window.document.querySelector('[data-nuvio-google-status]'),
    'Successful retry removes error message',
  );
  failed.window.close();
  const numeric = new JSDOM(
    '<div data-attrid="title">1917</div><div data-attrid="subtitle">2019</div><div data-attrid="kc:/film/film:media_actions_wholepage"></div>',
    { url: 'https://www.google.com/search?q=1917', runScripts: 'outside-only' },
  );
  let numericEvidence;
  numeric.window.chrome = {
    runtime: {
      sendMessage: async (m) => {
        numericEvidence = m;
        return { error: 'Test only' };
      },
    },
  };
  for (const f of ['settings.js', 'button-icon.js', 'google-core.js', 'google.js'])
    numeric.window.eval(fs.readFileSync(root + f, 'utf8'));
  await sleep();
  check(
    numericEvidence.titles[0] === '1917',
    'Genuine numeric primary titles remain supported',
  );
  numeric.window.close();
  const input = {
    type: 'nuvio:trakt-identify',
    titles: ['Couture'],
    year: 2025,
    kind: 'movie',
    directors: ['Alice Winocour'],
  };
  check(
    (await send(input)).identity?.id === 'tt34688195',
    'Google 2025/Trakt 2026 accepted with exact director',
  );
  wrongDirector = true;
  check((await send(input)).error, 'One-year discrepancy rejected with wrong director');
  wrongDirector = false;
  check(
    (await send({ ...input, directors: [] })).error,
    'One-year discrepancy rejected without director',
  );
  check((await send({ ...input, year: 2024 })).error, 'Two-year discrepancy rejected');
  check(
    (await send({ ...input, titles: ['2025'] })).error,
    'Unmatched numeric title evidence rejected',
  );
  console.log('TOTAL ' + n + ' real catalog regression checks passed');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
