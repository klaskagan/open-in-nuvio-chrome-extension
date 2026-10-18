const fs = require('node:fs');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fixture = require('./fixtures/google-native-lv.json');
const script = fs.readFileSync(__dirname + '/../open-in-nuvio/google-trakt.js', 'utf8');
let checks = 0;
function check(value, message) {
  assert(value, message);
  console.log('PASS ' + message);
  checks++;
}
function setup(labels, transform = () => {}) {
  const d = new JSDOM('<style>' + fixture.css + '</style>' + fixture.html, {
    url: 'https://www.google.com/search?q=Interstellar',
    runScripts: 'outside-only',
  });
  const w = d.window,
    target = w.document.querySelector('[data-attrid]');
  target.querySelector('.hg5Jzc').textContent = labels[0];
  target.querySelector('.ad7nsf').textContent = labels[1];
  target.querySelector('#NXD9g .QuU3Wb').textContent = labels[2];
  target.querySelector('#NXD9g').setAttribute('aria-label', labels[2]);
  transform(target);
  const messages = [];
  let fail = false;
  w.NuvioSettings = {
    get: () => ({ enabled: true, traktControls: true, sites: { google: true } }),
  };
  w.chrome = {
    runtime: {
      id: 'test',
      onMessage: { addListener() {} },
      sendMessage: async (m) => {
        messages.push(m);
        if (fail) return { error: 'Offline' };
        return {
          title: 'Interstellar',
          watched: m.action === 'watched' && m.desired,
          watchlist: m.action === 'watchlist' && m.desired,
        };
      },
    },
  };
  w.eval(script);
  const info = { id: 'tt0816692', kind: 'movie', key: 'test', target, valid: () => true };
  return {
    w,
    target,
    messages,
    info,
    fail: () => {
      fail = true;
    },
  };
}
(async () => {
  // Test data only: production has no translation table or locale branching.
  for (const [lang, labels] of Object.entries({
    lv: ['Skatīts', 'Vai to jau skatījāties?', 'Vēlos skatīties'],
    ru: ['Просмотрено', 'Посмотрели?', 'Хочу посмотреть'],
    en: ['Watched', 'Watched?', 'Want to watch'],
    lt: ['Žiūrėta', 'Žiūrėta', 'Noriu žiūrėti'],
    de: ['Gesehen', 'Schon gesehen?', 'Merken'],
    fr: ['Vu', 'Déjà vu ?', 'À regarder'],
    es: ['Vista', '¿La has visto?', 'Quiero verla'],
    ar: ['تمت المشاهدة', 'هل شاهدته؟', 'أريد مشاهدته'],
    ja: ['視聴済み', '視聴しましたか？', '見たい'],
    zh: ['看过', '看过了吗？', '想看'],
    unknown: ['Σ ✓', 'Неизвестен въпрос', 'नंतर पाहा'],
  })) {
    const { w, target, messages, info } = setup(labels);
    let nativeClicks = 0;
    target.addEventListener('click', () => nativeClicks++);
    await w.NuvioGoogleTrakt.sync(info);
    const watched = target.querySelector('[data-nuvio-trakt-control=watched]');
    const list = target.querySelector('[data-nuvio-trakt-control=watchlist]');
    check(watched && list, lang + ': identified without translating labels');
    check(
      watched.querySelector('.nuvio-trakt-label').textContent === labels[1] &&
        list.querySelector('.nuvio-trakt-label').textContent === labels[2],
      lang + ': exact native unselected labels reused',
    );
    check(
      watched.className === target.querySelector('#lbaHdc').className &&
        list.className === target.querySelector('#NXD9g').className,
      lang + ': original layout classes preserved',
    );
    check(
      !watched.querySelector('[jsaction],[jscontroller],[id]') &&
        !watched.hasAttribute('jscontroller') &&
        !list.hasAttribute('id'),
      lang + ': Google behavior and duplicate IDs removed',
    );
    check(
      list.querySelector('svg path').getAttribute('d').endsWith('V5h10v13z'),
      lang + ': outline bookmark uses SVG',
    );
    const subtitle = list.querySelector('small');
    check(
      subtitle.textContent === 'Trakt' &&
        w.getComputedStyle(subtitle).color === 'rgb(173, 133, 195)',
      lang + ': purple Trakt subtitle retained',
    );
    check(
      w.getComputedStyle(subtitle).lineHeight ===
        w.getComputedStyle(target.querySelector('.Z4yf9b .ZYHQ7e')).lineHeight &&
        w.getComputedStyle(subtitle).marginTop ===
          w.getComputedStyle(target.querySelector('.Z4yf9b .ZYHQ7e')).marginTop,
      lang + ': native provider subtitle spacing inherited',
    );
    await watched.onclick();
    check(
      watched.querySelector('.nuvio-trakt-label').textContent === labels[0],
      lang + ': native selected label reused',
    );
    list.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
    check(
      nativeClicks === 0 && messages.filter((m) => m.action === 'watchlist').length === 1,
      lang + ': one Trakt write and no Google click',
    );
    const count = messages.length;
    await w.NuvioGoogleTrakt.sync(info);
    check(
      messages.length === count && list.isConnected,
      lang + ': stable resync does not reload status',
    );
    w.NuvioGoogleTrakt.clear();
    check(
      !target.querySelector('[data-nuvio-trakt-control]') &&
        target.querySelector('#NXD9g').style.display === '',
      lang + ': clear restores untouched originals',
    );
    w.close();
  }
  const fallback = setup(['A', 'B', 'C'], (target) =>
    target.querySelectorAll('[id],[jscontroller],[jsname]').forEach((e) => {
      e.removeAttribute('id');
      e.removeAttribute('jscontroller');
      if (e.getAttribute('jsname') !== 'Q6Aqdc') e.removeAttribute('jsname');
    }),
  );
  await fallback.w.NuvioGoogleTrakt.sync(fallback.info);
  check(
    fallback.target.querySelectorAll('[data-nuvio-trakt-control]').length === 2,
    'SVG semantics identify actions when Google controller markers change',
  );
  fallback.w.close();
  const ambiguous = setup(['A', 'B', 'C'], (target) =>
    target.append(target.querySelector('#NXD9g').cloneNode(true)),
  );
  await ambiguous.w.NuvioGoogleTrakt.sync(ambiguous.info);
  check(
    !ambiguous.messages.length &&
      !ambiguous.target.querySelector('[data-nuvio-trakt-control]'),
    'Ambiguous controls do not guess or call API',
  );
  ambiguous.w.close();
  const keyboard = setup(['A', 'B', 'C']);
  await keyboard.w.NuvioGoogleTrakt.sync(keyboard.info);
  const control = keyboard.target.querySelector('[data-nuvio-trakt-control=watchlist]');
  control.dispatchEvent(
    new keyboard.w.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }),
  );
  await new Promise((r) => setTimeout(r, 0));
  check(
    keyboard.messages.filter((m) => m.action).length === 1,
    'Enter activates Trakt exactly once',
  );
  control.dispatchEvent(
    new keyboard.w.KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    }),
  );
  check(
    keyboard.messages.filter((m) => m.action).length === 1,
    'Space keydown does not write or scroll',
  );
  control.dispatchEvent(
    new keyboard.w.KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }),
  );
  await new Promise((r) => setTimeout(r, 0));
  check(
    keyboard.messages.filter((m) => m.action).length === 2,
    'Space release activates Trakt exactly once',
  );
  keyboard.fail();
  await control.onclick();
  check(
    control.getAttribute('aria-pressed') === 'false' && control.title === 'Offline',
    'Failed write rolls state back and exposes error',
  );
  keyboard.w.close();
  console.log('TOTAL ' + checks + ' native Google language and layout checks passed');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
