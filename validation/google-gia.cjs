const fs = require('fs'),
  assert = require('assert'),
  { JSDOM } = require('jsdom');
const root = __dirname + '/../open-in-nuvio/';
let n = 0;
(async () => {
  for (const [heading, kind, expected] of [
    ['Gia (TV Movie 1998)', 'movie', true],
    ['Gia (1998)', 'movie', true],
    ['Gia (TV Series 1998)', 'movie', false],
    ['Gia (TV Movie 1999)', 'movie', false],
    ['Gia (Video Game 1998)', 'movie', false],
    ['Gia (TV Series 1998–2000)', 'series', true],
    ['Gia (TV Movie 1998)', 'series', false],
  ]) {
    const prefix = kind === 'movie' ? 'kc:/film/film:' : 'kc:/tv/tv_program:';
    const doc = new JSDOM(
      `<div data-attrid="title">Džija</div><div data-attrid="subtitle">1998 m.</div><div data-attrid="description"><span><span>Gia is a 1998 American biographical drama television film about Gia Carangi.</span></span></div><div data-attrid="${prefix}media_actions_wholepage"></div><a href="https://www.imdb.com/title/tt0123865/"><h3>${heading}</h3></a>`,
      {
        url: 'https://www.google.com/search?q=D%C5%BEija+1998',
        runScripts: 'outside-only',
      },
    );
    let calls = 0,
      ui;
    const orig = doc.window.Element.prototype.attachShadow;
    doc.window.Element.prototype.attachShadow = function (o) {
      ui = orig.call(this, o);
      return ui;
    };
    doc.window.chrome = {
      runtime: {
        sendMessage: async () => {
          calls++;
          return { error: 'Fixture fallback' };
        },
      },
    };
    for (const f of ['settings.js', 'button-icon.js', 'google-core.js', 'google.js'])
      doc.window.eval(fs.readFileSync(root + f, 'utf8'));
    await new Promise((r) => setTimeout(r, 180));
    assert.equal(Boolean(ui), expected);
    assert.equal(calls, expected ? 0 : 1);
    if (expected)
      assert.equal(
        ui.querySelector('.imdb').href,
        'https://www.imdb.com/title/tt0123865/',
      );
    console.log('PASS ' + kind + ' ' + heading);
    n++;
    doc.window.close();
  }
  console.log('TOTAL ' + n + ' Gia title format checks passed');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
