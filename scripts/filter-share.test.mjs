import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppFixture, videoRow } from './app-test-fixture.mjs';

const rows = () => [
  videoRow('aaaaaaaaaaa', { number: '001', title: 'Same song', artist: 'Z', '公開月': '2026-09-01', 'カテゴリ': 'コラボ', '動画種別': '歌枠', '担当区分': 'VOCAL', 'コラボライバー': 'A,B', 'コラボユニット': 'Unit' }),
  videoRow('bbbbbbbbbbb', { number: '002', title: 'Same song', artist: 'A', '公開月': '2026-09-02', 'カテゴリ': 'ソロ', 'Shorts': 'TRUE' }),
  videoRow('ccccccccccc', { number: '003', title: 'Other song', artist: 'C', '公開月': '2026-09-03', platform: 'TikTok' })
];
const settle = () => new Promise(resolve => setImmediate(resolve));
const share = app => app.document.getElementById('desktopShareFilters');
const snapshot = app => JSON.stringify(app.window.FilterState.getState());
function clipboard(app, writeText) {
  Object.defineProperty(app.window.navigator, 'clipboard', { configurable: true, value: { writeText } });
}
function changeHash(app, hash) {
  app.window.history.replaceState(null, '', hash || '/');
  app.window.dispatchEvent(new app.window.HashChangeEvent('hashchange'));
}

test('share controls only appear for search, include, exclude or nondefault sort; resets hide them', async t => {
  const app = await createAppFixture(t, rows());
  const buttons = [...app.document.querySelectorAll('[data-share-filters]')];
  assert.equal(buttons.length, 2);
  assert.ok(buttons.every(button => button.hidden));
  for (const state of [{ searchQuery: 'Same' }, { include: { category: 'ソロ' } }, { exclude: { flag: ['Shorts'] } }, { sortOrder: 'asc' }]) {
    app.window.FilterState.setState(state);
    app.window.applyFilters({ scrollAfterUpdate: false });
    assert.ok(buttons.every(button => !button.hidden));
    app.window.resetAllFilters();
    assert.ok(buttons.every(button => button.hidden));
  }
  app.window.applySearchQuery('  ');
  assert.ok(buttons.every(button => button.hidden));
});

test('shared conditions restore before the first render and do not autoplay or persist', async t => {
  const url = 'https://site.test/#filters=1&q=Same&sort=asc&in.platform=youtube&out.flag=Shorts';
  const app = await createAppFixture(t, rows(), { url });
  assert.deepEqual(app.visibleKeys(), ['aaaaaaaaaaa__0']);
  assert.equal(app.document.getElementById('searchInput').value, 'Same');
  assert.equal(app.document.getElementById('mobileSearchInput').value, 'Same');
  assert.equal(app.document.getElementById('sortOrder').value, 'asc');
  assert.equal(app.window.FilterState.isTagExcluded('flag', 'Shorts'), true);
  assert.equal(app.document.getElementById('desktopResultVisible').textContent, '1');
  assert.equal(app.document.getElementById('mobileResultVisible').textContent, '1');
  assert.equal(app.window.location.href, url);
  assert.deepEqual(app.youtube.commands, []);
  assert.equal(app.window.nowPlayingKey, null);
  assert.equal(app.window.NumberInspection.isEnabled(), false);
  assert.deepEqual(Object.keys(app.window.localStorage), []);
  app.window.clearSearchQuery({ scrollAfterUpdate: false });
  await app.window.loadVideoData();
  assert.equal(app.window.FilterState.getState().searchQuery, '', 'data refresh must not reapply the original URL');
});

test('copy shares conditions without changing cards, playback, focus, scroll, storage or address', async t => {
  const app = await createAppFixture(t, rows());
  app.window.applySearchQuery('Same');
  app.youtube.ready();
  app.play('aaaaaaaaaaa__0');
  const disclosure = app.document.querySelector('.collab-member-toggle');
  disclosure.click();
  const cards = [...app.document.querySelectorAll('#videoList [data-video-key]')];
  const state = snapshot(app);
  const commands = app.youtube.commands.length;
  const scrolls = app.scrolls.length;
  const location = app.window.location.href;
  const storage = JSON.stringify({ ...app.window.localStorage });
  const writes = [];
  let resolveCopy;
  clipboard(app, text => { writes.push(text); return new Promise(resolve => { resolveCopy = resolve; }); });
  share(app).focus();
  share(app).click();
  assert.equal(app.document.getElementById('filterShareToast').hidden, true);
  resolveCopy();
  await settle();
  assert.equal(writes.length, 1);
  assert.equal(writes[0], 'https://site.test/#filters=1&q=Same');
  assert.deepEqual([...app.document.querySelectorAll('#videoList [data-video-key]')], cards);
  assert.equal(snapshot(app), state);
  assert.equal(app.youtube.commands.length, commands);
  assert.equal(app.scrolls.length, scrolls);
  assert.equal(app.window.location.href, location);
  assert.equal(JSON.stringify({ ...app.window.localStorage }), storage);
  assert.equal(app.document.activeElement, share(app));
  assert.equal(disclosure.getAttribute('aria-expanded'), 'true');
  assert.match(app.document.getElementById('filterShareToast').textContent, /コピーしました/);
});

for (const unavailable of [false, true]) {
  test(`clipboard ${unavailable ? 'unavailable' : 'denied'} opens a selected read-only URL and restores focus on close`, async t => {
    const app = await createAppFixture(t, rows());
    app.window.applySearchQuery('Same');
    if (!unavailable) clipboard(app, async () => { throw new Error('denied'); });
    share(app).focus();
    share(app).click();
    await settle();
    const dialog = app.document.getElementById('filterShareDialog');
    const input = app.document.getElementById('filterShareUrlInput');
    assert.equal(dialog.open, true);
    assert.equal(input.readOnly, true);
    assert.equal(app.document.activeElement, input);
    assert.equal(input.selectionStart, 0);
    assert.equal(input.selectionEnd, input.value.length);
    assert.equal(input.value, 'https://site.test/#filters=1&q=Same');
    assert.equal(app.document.getElementById('filterShareToast').hidden, true);
    dialog.dispatchEvent(new app.window.Event('cancel', { cancelable: true }));
    assert.equal(dialog.open, false);
    assert.equal(app.document.activeElement, share(app));
    assert.equal(app.document.body.style.overflow, '');
  });
}

test('stale clipboard completion after condition changes or another dialog cannot steal focus', async t => {
  const app = await createAppFixture(t, rows());
  let rejectCopy;
  clipboard(app, () => new Promise((resolve, reject) => { rejectCopy = reject; }));
  app.window.applySearchQuery('Same');
  share(app).click();
  app.window.resetAllFilters();
  rejectCopy(new Error('denied'));
  await settle();
  assert.equal(app.document.getElementById('filterShareDialog').open, false);
  app.window.applySearchQuery('Same');
  share(app).click();
  app.document.getElementById('openSiteInfoModal').click();
  rejectCopy(new Error('denied'));
  await settle();
  assert.equal(app.document.getElementById('filterShareDialog').open, false);
  assert.equal(app.document.getElementById('siteInfoModal').open, true);
});

test('hash changes replace rather than merge conditions and keep playback; empty hash restores defaults', async t => {
  const app = await createAppFixture(t, rows());
  app.youtube.ready();
  app.play('aaaaaaaaaaa__0');
  const commands = app.youtube.commands.length;
  changeHash(app, '#filters=1&in.category=ソロ&sort=asc');
  assert.deepEqual(app.visibleKeys(), ['bbbbbbbbbbb__0']);
  changeHash(app, '#filters=1&q=Other');
  assert.deepEqual(app.visibleKeys(), ['ccccccccccc__0']);
  assert.equal(app.window.FilterState.getState().include.category, '');
  assert.equal(app.window.FilterState.getState().sortOrder, 'desc');
  assert.equal(app.youtube.commands.length, commands);
  changeHash(app, '');
  assert.equal(app.visibleKeys().length, 3);
  assert.equal(share(app).hidden, true);
  assert.equal(app.window.nowPlayingKey, 'aaaaaaaaaaa__0');
});

test('hash navigation cancels pending mobile changes and synchronizes open controls', async t => {
  const app = await createAppFixture(t, rows(), { mobile: true });
  app.document.getElementById('openFilterModal').click();
  app.document.querySelector('#filterModal button[data-sort="asc"]').click();
  changeHash(app, '#filters=1&q=Same&sort=title');
  assert.equal(app.document.getElementById('modalSortOrder').value, 'title');
  assert.equal(app.document.querySelector('#filterModal button[data-sort="title"]').getAttribute('aria-pressed'), 'true');
  assert.equal(app.document.getElementById('modalResultVisible').textContent, '2');
  const state = snapshot(app);
  let renders = 0;
  app.window.addEventListener('videoListRendered', () => { renders++; });
  app.document.getElementById('applyFilters').click();
  await app.flushFrames();
  assert.equal(renders, 0);
  assert.equal(snapshot(app), state);
});

test('invalid URLs show a notice and default list; unrelated anchors leave filters alone', async t => {
  const app = await createAppFixture(t, rows(), { url: 'https://site.test/#filters=9&q=Same' });
  assert.equal(app.visibleKeys().length, 3);
  assert.match(app.document.getElementById('filterShareToast').textContent, /読み込めませんでした/);
  app.window.applySearchQuery('Other');
  changeHash(app, '#videoList');
  assert.deepEqual(app.visibleKeys(), ['ccccccccccc__0']);
  changeHash(app, '#filters=1&q=%ZZ');
  assert.equal(app.visibleKeys().length, 3);
  assert.match(app.document.getElementById('filterShareToast').textContent, /読み込めませんでした/);
});

test('unknown data tags stay in chips with zero results, and conflicting flags use FilterState rules', async t => {
  const app = await createAppFixture(t, rows(), { url: 'https://site.test/#filters=1&in.collab=RemovedMember&in.format=Shorts&out.flag=Shorts' });
  assert.equal(app.visibleKeys().length, 0);
  assert.match(app.document.getElementById('activeTagChips').textContent, /RemovedMember/);
  assert.equal(app.window.FilterState.isTagIncluded('flag', 'Shorts'), false);
  assert.equal(app.window.FilterState.isTagExcluded('flag', 'Shorts'), true);
  assert.equal(share(app).hidden, false);
});

test('shared URLs and search labels never become HTML, and canonical metadata stays unchanged', async t => {
  const query = '<img src=x onerror=alert(1)> & "歌"';
  const app = await createAppFixture(t, rows(), { url: `https://site.test/#filters=1&q=${encodeURIComponent(query)}` });
  assert.equal(app.window.FilterState.getState().searchQuery, query);
  assert.equal(app.document.querySelector('#activeTagChips img'), null);
  assert.equal(app.document.querySelector('link[rel="canonical"]').href, 'https://shigarikosong.github.io/');
  assert.equal(app.document.title, 'しがりこのうた、おどり。｜司賀りこ非公式ファンサイト');
});

test('copy and reopen reproduce all groups, multi-value exclusions and playback candidate order', async t => {
  const app = await createAppFixture(t, rows());
  app.window.FilterState.setState({
    searchQuery: 'Same OR Other -absent', sortOrder: 'artist',
    include: { category: 'コラボ', platform: 'youtube', date: 'year', format: ['歌枠'], role: ['VOCAL', 'DANCE'], collab: ['A', 'B'] },
    exclude: { category: ['ソロ'], platform: ['tiktok'], date: ['old'], format: ['企画'], role: ['CHORUS'], collab: ['X', 'Y'], flag: ['Shorts'] }
  });
  app.window.applyFilters({ scrollAfterUpdate: false });
  let copied;
  clipboard(app, async url => { copied = url; });
  share(app).click();
  await settle();
  const receiver = await createAppFixture(t, rows(), { url: copied });
  const normalizeSets = state => JSON.parse(JSON.stringify(state, (key, value) => Array.isArray(value) ? [...value].sort() : value));
  assert.deepEqual(normalizeSets(receiver.window.FilterState.getState()), normalizeSets(app.window.FilterState.getState()));
  assert.deepEqual(receiver.visibleKeys(), app.visibleKeys());
  assert.deepEqual(Array.from(receiver.window.currentFilteredVideos, receiver.window.getVideoKey), receiver.visibleKeys());
  assert.deepEqual(receiver.youtube.commands, []);
});

test('the newest copy owns feedback, and native dialog close restores body state', async t => {
  const app = await createAppFixture(t, rows());
  app.window.applySearchQuery('Same');
  const pending = [];
  clipboard(app, () => new Promise((resolve, reject) => pending.push({ resolve, reject })));
  share(app).click();
  share(app).click();
  pending[1].resolve();
  await settle();
  pending[0].reject(new Error('denied'));
  await settle();
  assert.equal(app.document.getElementById('filterShareDialog').open, false);
  assert.match(app.document.getElementById('filterShareToast').textContent, /コピーしました/);
  app.document.body.style.overflow = 'auto';
  share(app).click();
  pending[2].reject(new Error('denied'));
  await settle();
  app.document.getElementById('filterShareDialog').close();
  assert.equal(app.document.body.style.overflow, 'auto');
  assert.equal(app.document.activeElement, share(app));
});

test('oversized conditions report failure without calling clipboard or changing filters', async t => {
  const app = await createAppFixture(t, rows());
  app.window.applySearchQuery('あ'.repeat(2000));
  let copies = 0;
  clipboard(app, async () => { copies++; });
  const state = snapshot(app);
  share(app).click();
  await settle();
  assert.equal(copies, 0);
  assert.equal(snapshot(app), state);
  assert.match(app.document.getElementById('filterShareToast').textContent, /作成できませんでした/);
});

test('closing the mobile modal applies pending sort before the list share operation', async t => {
  const app = await createAppFixture(t, rows(), { mobile: true });
  app.document.getElementById('openFilterModal').click();
  app.document.querySelector('#filterModal button[data-sort="asc"]').click();
  app.document.getElementById('applyFilters').click();
  await app.flushFrames();
  const button = app.document.getElementById('mobileShareFilters');
  assert.equal(button.hidden, false);
  let copied;
  clipboard(app, async url => { copied = url; });
  button.click();
  await settle();
  assert.equal(copied, 'https://site.test/#filters=1&sort=asc');
  const receiver = await createAppFixture(t, rows(), { url: copied });
  assert.deepEqual(receiver.visibleKeys(), app.visibleKeys());
});
