import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../site-home-link.js', import.meta.url), 'utf8');

function fixture(t, url) {
  const dom = new JSDOM(html, { url });
  t.after(() => dom.window.close());
  const link = dom.window.document.getElementById('siteHomeLink');
  const calls = [];
  const location = new URL(url);
  location.reload = () => calls.push(['reload', location.href]);
  vm.runInNewContext(source, {
    document: dom.window.document, URL, location,
    history: { pushState(state, title, href) {
      calls.push(['push', href]);
      location.href = href;
    } },
    window: { scrollTo: (...args) => calls.push(['scroll', ...args]) }
  });
  return {
    link, calls, location,
    click(options = {}) {
      const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, ...options });
      if (options.defaultPrevented) event.preventDefault();
      let prevented;
      // Observe native navigation without asking jsdom to perform it.
      link.addEventListener('click', current => {
        prevented = current.defaultPrevented;
        current.preventDefault();
      }, { once: true });
      link.dispatchEvent(event);
      return prevented;
    }
  };
}

for (const base of ['https://shigarikosong.github.io/', 'https://preview.test/', 'https://preview.test/archive/']) {
  test(`title reloads a shared URL at the clean home and preserves a Back entry: ${base}`, t => {
    const app = fixture(t, `${base}#filters=1&q=Song&sort=asc`);
    assert.equal(app.link.tagName, 'A');
    assert.equal(app.link.href, base);
    assert.equal(app.click(), true);
    assert.deepEqual(app.calls, [['push', base], ['scroll', 0, 0], ['reload', base]]);
  });
}

test('an already clean URL still reloads without adding a history entry', t => {
  const app = fixture(t, 'https://site.test/');
  assert.equal(app.click(), true);
  assert.deepEqual(app.calls, [['scroll', 0, 0], ['reload', 'https://site.test/']]);
});

for (const suffix of ['?manualPlay=1#filters=1&q=Song', 'index.html#filters=1&q=Song']) {
  test(`a different path or query uses native document navigation: ${suffix}`, t => {
    const app = fixture(t, `https://site.test/${suffix}`);
    assert.equal(app.link.href, 'https://site.test/');
    assert.equal(app.click(), false);
    assert.deepEqual(app.calls, []);
  });
}

for (const options of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }]) {
  test(`modified or cancelled activation is left alone: ${JSON.stringify(options)}`, t => {
    const app = fixture(t, 'https://site.test/#filters=1&q=Song');
    assert.equal(app.click(options), Boolean(options.defaultPrevented));
    assert.deepEqual(app.calls, []);
  });
}
