import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppFixture, videoRow } from './app-test-fixture.mjs';

const firstId = 'aaaaaaaaaaa';
const secondId = 'bbbbbbbbbbb';
const rows = () => [
  videoRow(firstId, { number: ' 006 ', title: 'Same song', '公開月': '2026-09-01' }),
  videoRow(firstId, { number: '71', title: 'Same song', start: 90, '公開月': '2026-09-02' }),
  videoRow(secondId, { number: '103', title: 'Other song', '公開月': '2026-09-03' })
];

function activate(app) {
  app.document.getElementById('openSiteInfoModal').click();
  for (let click = 0; click < 5; click++) app.document.getElementById('numberInspectionTrigger').click();
}

function closeInfo(app) {
  app.document.getElementById('closeSiteInfoModalBottom').click();
}

function displayedNumbers(app) {
  return Array.from(app.document.querySelectorAll('#videoList .video-number-value'), element => element.textContent);
}

function setClipboard(app, writeText) {
  Object.defineProperty(app.window.navigator, 'clipboard', { configurable: true, value: { writeText } });
}

test('numbers stay absent until five consecutive activations in the open info dialog', async t => {
  const app = await createAppFixture(t, rows());
  const { window, document } = app;
  const trigger = document.getElementById('numberInspectionTrigger');
  assert.equal(window.NumberInspection.isEnabled(), false);
  assert.equal(document.getElementById('numberInspectionControls').hidden, true);
  assert.deepEqual(displayedNumbers(app), []);
  for (let click = 0; click < 5; click++) trigger.click();
  assert.equal(window.NumberInspection.isEnabled(), false, 'a closed dialog cannot activate the mode');
  document.getElementById('openSiteInfoModal').click();
  for (let click = 0; click < 4; click++) trigger.click();
  assert.equal(window.NumberInspection.isEnabled(), false);
  trigger.click();
  assert.equal(window.NumberInspection.isEnabled(), true);
  assert.equal(document.getElementById('numberInspectionControls').hidden, false);
  assert.equal(document.querySelectorAll('.video-number-copy').length, 3);
  assert.deepEqual(displayedNumbers(app), ['103', '71', '006']);
  assert.equal(document.getElementById('siteInfoModal').open, true);
});

test('pausing or closing the dialog resets the hidden activation sequence', async t => {
  const app = await createAppFixture(t, rows());
  const trigger = app.document.getElementById('numberInspectionTrigger');
  app.document.getElementById('openSiteInfoModal').click();
  for (let click = 0; click < 4; click++) trigger.click();
  app.sampleTime(0, 2001);
  trigger.click();
  assert.equal(app.window.NumberInspection.isEnabled(), false);
  closeInfo(app);
  app.document.getElementById('openSiteInfoModal').click();
  for (let click = 0; click < 4; click++) trigger.click();
  assert.equal(app.window.NumberInspection.isEnabled(), false);
  trigger.click();
  assert.equal(app.window.NumberInspection.isEnabled(), true);
});

test('mode changes preserve cards, search, sort, tag state, playback and expanded members', async t => {
  const data = rows().map(row => ({ ...row, '担当区分': 'VOCAL', 'コラボライバー': 'A,B', 'コラボユニット': 'Unit' }));
  const app = await createAppFixture(t, data);
  const { window, document } = app;
  window.FilterState.setState({ searchQuery: 'Same', sortOrder: 'asc', include: { role: ['VOCAL'] } });
  window.applyFilters({ scrollAfterUpdate: false });
  app.youtube.ready();
  app.play(`${firstId}__0`);
  const cards = Array.from(document.querySelectorAll('#videoList [data-video-key]'));
  const disclosure = cards[0].querySelector('.collab-member-toggle');
  disclosure.click();
  const state = JSON.stringify(window.FilterState.getState());
  const filtered = window.currentFilteredVideos;
  const commands = app.youtube.commands.length;
  const storage = JSON.stringify({ ...window.localStorage });
  let renders = 0;
  window.addEventListener('videoListRendered', () => { renders++; });
  activate(app);
  closeInfo(app);
  assert.deepEqual(Array.from(document.querySelectorAll('#videoList [data-video-key]')), cards);
  assert.equal(disclosure.getAttribute('aria-expanded'), 'true');
  assert.equal(window.currentFilteredVideos, filtered);
  assert.equal(JSON.stringify(window.FilterState.getState()), state);
  assert.equal(window.nowPlayingKey, `${firstId}__0`);
  assert.equal(app.youtube.commands.length, commands);
  assert.equal(JSON.stringify({ ...window.localStorage }), storage);
  assert.equal(renders, 0);
  window.NumberInspection.setEnabled(false);
  assert.equal(renders, 0);
  assert.deepEqual(displayedNumbers(app), []);
  assert.deepEqual(Array.from(document.querySelectorAll('#videoList [data-video-key]')), cards);
  assert.equal(disclosure.getAttribute('aria-expanded'), 'true');
});

test('inspection numbers follow filtering, reuse, sorting and data reloads without duplicates', async t => {
  const data = rows();
  const app = await createAppFixture(t, data);
  activate(app);
  closeInfo(app);
  app.window.applySearchQuery('Same', { scrollAfterUpdate: false });
  assert.deepEqual(displayedNumbers(app), ['71', '006']);
  const card = app.document.querySelector('#videoList [data-video-key]');
  app.window.applySearchQuery('Same OR absent', { scrollAfterUpdate: false });
  assert.equal(app.document.querySelector('#videoList [data-video-key]'), card);
  assert.deepEqual(displayedNumbers(app), ['71', '006']);
  app.window.FilterState.setState({ sortOrder: 'asc' });
  app.window.applyFilters({ scrollAfterUpdate: false });
  assert.deepEqual(displayedNumbers(app), ['006', '71']);
  data[0].number = '800';
  await app.window.loadVideoData();
  assert.deepEqual(displayedNumbers(app), ['800', '71']);
  app.window.resetAllFilters();
  assert.deepEqual(displayedNumbers(app), ['103', '71', '800']);
  assert.deepEqual(Array.from(app.window.currentFilteredVideos, app.window.getVideoKey), app.visibleKeys());
});

test('empty results and rows without a number do not invent an index as an ID', async t => {
  const app = await createAppFixture(t, [videoRow(firstId), videoRow(secondId, { number: 0 })]);
  app.window.applySearchQuery('absent', { scrollAfterUpdate: false });
  activate(app);
  closeInfo(app);
  assert.deepEqual(displayedNumbers(app), []);
  app.window.clearSearchQuery({ scrollAfterUpdate: false });
  assert.deepEqual(displayedNumbers(app), ['0']);
  assert.equal(app.document.querySelector(`[data-video-key="${firstId}__0"] .video-number-copy`), null);
});

test('exit hides controls, restores focus and does not persist the mode', async t => {
  const app = await createAppFixture(t, rows());
  activate(app);
  const exit = app.document.getElementById('exitNumberInspection');
  exit.focus();
  exit.click();
  assert.equal(app.window.NumberInspection.isEnabled(), false);
  assert.equal(app.document.getElementById('numberInspectionControls').hidden, true);
  assert.equal(app.document.activeElement.id, 'numberInspectionTrigger');
  assert.deepEqual(displayedNumbers(app), []);
  assert.equal(app.document.querySelector('.has-video-number'), null);
  activate(app);
  const fresh = await createAppFixture(t, rows(), { storage: { ...app.window.localStorage } });
  assert.equal(fresh.window.NumberInspection.isEnabled(), false);
  assert.deepEqual(displayedNumbers(fresh), []);
});

test('copy writes the exact normalized number only and does not search or play', async t => {
  const app = await createAppFixture(t, rows());
  const written = [];
  setClipboard(app, async value => written.push(value));
  activate(app);
  closeInfo(app);
  const before = app.visibleKeys();
  const button = app.document.querySelector(`[data-video-key="${firstId}__0"] .video-number-copy`);
  assert.match(button.getAttribute('aria-label'), /006/);
  button.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(written, ['006']);
  assert.deepEqual(app.visibleKeys(), before);
  assert.deepEqual(app.youtube.commands, []);
  assert.equal(app.window.FilterState.getState().searchQuery, '');
  const toast = app.document.getElementById('numberInspectionToast');
  assert.equal(toast.hidden, false);
  assert.match(toast.textContent, /006.*コピーしました/);
});

for (const unavailable of [false, true]) {
  test(`copy ${unavailable ? 'unavailable' : 'denied'} reports failure and selects the number for manual copying`, async t => {
    const app = await createAppFixture(t, rows());
    if (!unavailable) setClipboard(app, async () => { throw new Error('NotAllowedError'); });
    activate(app);
    closeInfo(app);
    app.document.querySelector(`[data-video-key="${firstId}__0"] .video-number-copy`).click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.window.getSelection().toString(), '006');
    assert.match(app.document.getElementById('numberInspectionToast').textContent, /コピーできませんでした/);
    assert.equal(app.window.NumberInspection.isEnabled(), true);
  });
}

test('late clipboard completion cannot restore feedback after exit or card removal', async t => {
  const app = await createAppFixture(t, rows());
  let finish;
  setClipboard(app, () => new Promise(resolve => { finish = resolve; }));
  activate(app);
  closeInfo(app);
  app.document.querySelector('.video-number-copy').click();
  app.window.NumberInspection.setEnabled(false);
  finish();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.document.getElementById('numberInspectionToast').hidden, true);
  app.window.NumberInspection.setEnabled(true);
  app.document.querySelector('.video-number-copy').click();
  app.window.applySearchQuery('absent', { scrollAfterUpdate: false });
  finish();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.document.getElementById('numberInspectionToast').hidden, true);
});

test('toggling the mode preserves the visible card anchor and safely removes focused copy buttons', async t => {
  const app = await createAppFixture(t, rows());
  const { window, document } = app;
  const card = document.querySelector('#videoList [data-video-key]');
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 100 });
  card.getBoundingClientRect = () => ({ top: window.NumberInspection.isEnabled() ? 85 : 40, bottom: 150 });
  window.NumberInspection.setEnabled(true);
  assert.deepEqual(app.scrolls.at(-1), [0, 145]);
  card.querySelector('.video-number-copy').focus();
  window.NumberInspection.setEnabled(false);
  assert.equal(document.activeElement.id, 'videoList');
});
