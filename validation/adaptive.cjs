const fs = require('fs'),
  assert = require('assert'),
  { JSDOM } = require('jsdom');
const root = __dirname + '/../open-in-nuvio/';
let n = 0;
const check = (v, m) => {
  assert(v, m);
  console.log('PASS ' + m);
  n++;
};
(async () => {
  for (const site of ['google', 'imdb', 'trakt']) {
    const d = new JSDOM(
        '<main><div class="trakt-summary-actions-bar"><button>Native</button><div id="host"></div></div></main>',
        { runScripts: 'outside-only' },
      ),
      w = d.window;
    let prefs = {},
      callbacks = [],
      disconnected = 0,
      width = 700;
    w.ResizeObserver = class {
      constructor(f) {
        this.fn = f;
        callbacks.push(this);
      }
      observe(e) {
        this.element = e;
      }
      disconnect() {
        disconnected++;
      }
    };
    w.chrome = {
      storage: {
        local: {
          get: async () => ({ nuvioSettings: prefs }),
          set: async (o) => {
            prefs = o.nuvioSettings;
          },
        },
        onChanged: { addListener: () => {} },
      },
    };
    const host = w.document.getElementById('host'),
      bar = host.parentElement,
      parent = site === 'trakt' ? bar.parentElement : bar;
    Object.defineProperty(parent, 'clientWidth', { get: () => width });
    bar.querySelector('button').getBoundingClientRect = () => ({ width: 40 });
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML =
      '<div class="row"><a class="nuvio" href="nuvio://imdb/movie/tt0117705" aria-label="Open in Nuvio"><img><span>Open in Nuvio</span></a><a class="trakt" href="https://trakt.tv/movies/tt0117705"><img><span>Open in Trakt</span></a></div>';
    if (site === 'trakt') {
      shadow.querySelector('.trakt').className = 'imdb';
      shadow.querySelector('.imdb span').textContent = 'Open in IMDb';
    }
    w.eval(fs.readFileSync(root + 'settings.js', 'utf8'));
    const S = w.NuvioSettings;
    await S.ready;
    check(S.get().appearance === 'auto', site + ': new default is Automatic');
    check(
      S.normalize({ compact: true }).appearance === 'compact' &&
        S.normalize({ compact: false }).appearance === 'labels',
      site + ': legacy setting migrates without changing appearance',
    );
    S.apply(site, host, shadow);
    check(
      host.dataset.nuvioAppearance === 'labels',
      site + ': wide container shows labels',
    );
    const observer = callbacks.at(-1);
    if (site === 'google') {
      width = 330;
      observer.fn([{ contentRect: { width } }]);
      width = 350;
      observer.fn([{ contentRect: { width } }]);
      check(
        host.dataset.nuvioAppearance === 'compact',
        'Threshold buffer prevents resize flicker',
      );
      width = 370;
      observer.fn([{ contentRect: { width } }]);
      check(
        host.dataset.nuvioAppearance === 'labels',
        'Labels return after sufficient space is available',
      );
    }
    width = 160;
    observer.fn([{ contentRect: { width } }]);
    check(
      host.dataset.nuvioAppearance === 'compact' &&
        shadow.querySelector('a span').style.display === 'none',
      site + ': narrow container switches to icons',
    );
    check(
      observer.element === parent,
      site + ': observes stable available parent rather than shrinking controls',
    );
    width = 700;
    observer.fn([{ contentRect: { width } }]);
    check(
      host.dataset.nuvioAppearance === 'labels',
      site + ': expanding restores labels',
    );
    await S.save({ ...S.get(), appearance: 'compact' });
    S.apply(site, host, shadow);
    check(
      host.dataset.nuvioAppearance === 'compact' && disconnected > 0,
      site + ': forced Compact ignores width and disconnects observer',
    );
    await S.save({ ...S.get(), appearance: 'labels' });
    width = 160;
    S.apply(site, host, shadow);
    check(
      host.dataset.nuvioAppearance === 'labels',
      site + ': forced Labels ignores narrow width',
    );
    await S.save({ ...S.get(), appearance: 'auto' });
    S.apply(site, host, shadow);
    check(
      host.dataset.nuvioAppearance === 'compact',
      site + ': switching back to Automatic recalculates immediately',
    );
    d.window.close();
  }
  console.log('TOTAL ' + n + ' adaptive appearance checks passed');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
