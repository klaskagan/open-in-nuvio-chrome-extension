const { JSDOM } = require('jsdom');
const fs = require('fs'),
  path = require('path'),
  assert = require('assert');
let n = 0;
const check = (v, m) => {
  assert(v, m);
  n++;
  console.log('PASS ' + m);
};
const wait = () => new Promise((r) => setTimeout(r, 300));
const src = fs.readFileSync(path.join(__dirname, '../open-in-nuvio/imdb.js'), 'utf8');
(async () => {
  const dom = new JSDOM('<body><h1>The Pianist</h1>', {
    url: 'https://www.imdb.com/title/tt0253474/?ref_=search',
    runScripts: 'outside-only',
  });
  const w = dom.window;
  const attach = w.Element.prototype.attachShadow;
  w.Element.prototype.attachShadow = function (o) {
    const s = attach.call(this, o);
    w.ui = s;
    return s;
  };
  w.eval(fs.readFileSync(path.join(__dirname, '../open-in-nuvio/settings.js'), 'utf8'));
  w.eval(
    fs.readFileSync(path.join(__dirname, '../open-in-nuvio/button-icon.js'), 'utf8'),
  );
  w.eval(src);
  check(
    !w.document.querySelector('[data-nuvio-imdb]'),
    'No floating IMDb buttons while loading',
  );
  const metadata = w.document.createElement('script');
  metadata.type = 'application/ld+json';
  metadata.textContent = JSON.stringify({
    '@type': 'Movie',
    url: 'https://www.imdb.com/title/tt0253474/',
  });
  w.document.head.append(metadata);
  await wait();
  check(
    !w.document.querySelector('[data-nuvio-imdb]'),
    'Metadata alone does not show buttons',
  );
  w.document.body.insertAdjacentHTML(
    'beforeend',
    '<aside><div class="ipc-split-button"><button data-testid="tm-box-wl-button">Add to Watchlist</button><button>More</button></div></aside>',
  );
  await wait();
  const widget = () => w.document.querySelector('[data-nuvio-imdb]');
  const link = (c) => w.ui.querySelector(c);
  check(
    widget()?.nextElementSibling?.classList.contains('ipc-split-button'),
    'Buttons immediately precede the complete watchlist control',
  );
  check(
    link('.nuvio').href === 'nuvio://imdb/movie/tt0253474',
    'Exact IMDb movie deep link',
  );
  check(
    link('.trakt').href === 'https://app.trakt.tv/movies/tt0253474',
    'Exact Trakt movie route by IMDb ID',
  );
  check(
    link('.trakt').target === '_blank' && link('.trakt').rel.includes('noopener'),
    'Trakt opens safely in a new tab',
  );
  check(
    w.document.querySelector('[data-testid="tm-box-wl-button"]').textContent ===
      'Add to Watchlist',
    'IMDb watchlist button untouched',
  );
  check(w.ui.querySelectorAll('a').length === 2, 'Exactly two actions');
  w.history.pushState({}, '', '/title/tt0903747/');
  const click = new w.MouseEvent('click', { cancelable: true });
  link('.nuvio').dispatchEvent(click);
  check(
    click.defaultPrevented,
    'Immediate click during SPA navigation cannot open stale movie',
  );
  await wait();
  check(!widget(), 'Old title metadata hidden after route change');
  const next = w.document.createElement('script');
  next.id = '__NEXT_DATA__';
  next.type = 'application/json';
  const setNext = (id, type) =>
    (next.textContent = JSON.stringify({
      props: { pageProps: { aboveTheFoldData: { id, titleType: { id: type } } } },
    }));
  setNext('tt0903747', 'tvSeries');
  w.document.head.append(next);
  await wait();
  check(
    link('.nuvio').href === 'nuvio://imdb/series/tt0903747',
    'TV series uses Nuvio series media type',
  );
  check(
    link('.trakt').href === 'https://app.trakt.tv/shows/tt0903747',
    'TV series uses Trakt shows route',
  );
  setNext('tt0903747', 'tvMiniSeries');
  await wait();
  check(Boolean(widget()), 'Miniseries supported');
  setNext('tt0903747', 'tvEpisode');
  await wait();
  check(!widget(), 'Episodes excluded');
  setNext('tt0903747', 'videoGame');
  await wait();
  check(!widget(), 'Video games excluded');
  next.remove();
  metadata.textContent = JSON.stringify({
    '@graph': [
      { '@type': 'Movie', url: 'https://www.imdb.com/title/tt0253474/' },
      { '@type': 'TVSeries', url: 'https://www.imdb.com/title/tt0903747/' },
    ],
  });
  await wait();
  check(
    link('.nuvio').href === 'nuvio://imdb/series/tt0903747',
    'JSON-LD graph matches exact route and ignores another title',
  );
  const watch = w.document.querySelector('.ipc-split-button');
  watch.remove();
  await wait();
  check(
    Boolean(widget()),
    'Verified buttons stay visible through temporary watchlist absence',
  );
  w.document.querySelector('aside').append(watch);
  await wait();
  check(
    w.document.querySelectorAll('[data-nuvio-imdb]').length === 1,
    'Watchlist remount restores exactly one widget',
  );
  w.history.pushState({}, '', '/title/tt0903747/reviews/');
  await wait();
  check(!widget(), 'Title subpages excluded');
  w.history.pushState({}, '', '/title/tt0253474/');
  metadata.textContent = '{invalid';
  await wait();
  check(!widget(), 'Malformed metadata never guesses media type');
  metadata.textContent = JSON.stringify({
    '@type': 'Movie',
    url: 'https://evil.example/title/tt0253474/',
  });
  await wait();
  check(!widget(), 'Foreign metadata URL rejected');
  dom.window.close();
  // A Trakt route opened from IMDb must still resolve the TMDB ID for its Nuvio action.
  const bridge = fs.readFileSync(
    path.join(__dirname, '../open-in-nuvio/bridge.js'),
    'utf8',
  );
  const b = new JSDOM('', {
    url: 'https://app.trakt.tv/movies/tt0253474',
    runScripts: 'outside-only',
  });
  const events = [];
  b.window.fetch = async (url) => ({
    url,
    ok: true,
    clone: () => ({
      json: async () => ({
        title: 'The Pianist',
        ids: { slug: 'the-pianist-2002', imdb: 'tt0253474', tmdb: 423 },
      }),
    }),
  });
  b.window.addEventListener('nuvio:metadata', (e) => events.push(JSON.parse(e.detail)));
  b.window.eval(bridge);
  await b.window.fetch('https://apiz.trakt.tv/movies/tt0253474?extended=full');
  await wait();
  check(
    events.some((e) => e.key === 'movies/tt0253474' && e.id === '423'),
    'Trakt bridge resolves exact IMDb route alias',
  );
  events.length = 0;
  await b.window.fetch('https://apiz.trakt.tv/movies/tt0000001?extended=full');
  await wait();
  check(
    !events.some((e) => e.key === 'movies/tt0000001'),
    'Unmatched IMDb route alias rejected',
  );
  b.window.close();
  console.log('TOTAL ' + n + ' IMDb and Trakt-alias checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
