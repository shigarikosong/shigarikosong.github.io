import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppFixture, videoRow } from './app-test-fixture.mjs';

const firstId = 'aaaaaaaaaaa';
const secondId = 'bbbbbbbbbbb';
const thirdId = 'ccccccccccc';
const tiktokId = '7123456789012345678';

for (const mobile of [false, true]) {
  test(`${mobile ? 'mobile' : 'desktop'} search applies immediately without repeating on change`, async t => {
    const app = await createAppFixture(t, [
      videoRow(firstId, { title: 'Keep Alpha' }),
      videoRow(secondId, { title: 'Keep Beta' }),
      videoRow(thirdId, { title: 'Other' })
    ], { mobile });
    const { window, document } = app;
    const input = document.getElementById(mobile ? 'mobileSearchInput' : 'searchInput');
    const otherInput = document.getElementById(mobile ? 'searchInput' : 'mobileSearchInput');
    let updates = 0;
    window.addEventListener('videoListRendered', () => { updates++; });
    input.focus();
    input.value = 'Keep';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(updates, 1, 'input applies synchronously, without a debounce');
    assert.equal(otherInput.value, 'Keep');
    assert.deepEqual(app.visibleKeys(), [`${firstId}__0`, `${secondId}__0`]);
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(updates, 1, 'committing an applied value does not update again');

    input.value = 'Keep Beta';
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(updates, 2, 'change-only input is still supported');
    assert.deepEqual(app.visibleKeys(), [`${secondId}__0`]);

    window.applySearchQuery('Keep', { scrollAfterUpdate: false });
    assert.equal(updates, 3);
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(updates, 3, 'programmatic searches also update the applied-value snapshot');
    document.getElementById(mobile ? 'clearMobileSearchInput' : 'clearSearchInput').click();
    assert.equal(updates, 4);
    assert.equal(input.value, '');
    assert.equal(otherInput.value, '');
    assert.equal(document.activeElement, input);
    assert.equal(app.visibleKeys().length, 3);
  });
}

test('unchanged search results reuse cards and widths while updating search controls and scroll', async t => {
  const app = await createAppFixture(t, [
    videoRow(firstId, { title: 'Keep Alpha' }), videoRow(secondId, { title: 'Keep Beta' })
  ]);
  const { window, document } = app;
  window.FilterState.setTagState('platform', 'youtube', 'include');
  window.applyFilters({ scrollAfterUpdate: false });
  const cards = Array.from(document.querySelectorAll('#videoList [data-video-key]'));
  const title = cards[0].querySelector('.video-title');
  title.focus();
  let widthUpdates = 0;
  const measureWidths = window.updateVideoSearchActionOverflow;
  window.updateVideoSearchActionOverflow = () => { widthUpdates++; measureWidths(); };
  const scrollRequests = [];
  window.requestSettledFilterScroll = options => scrollRequests.push(options);
  let notifications = 0;
  window.addEventListener('videoListRendered', () => { notifications++; });

  window.applySearchQuery('Keep', { sourceVideoKey: `${firstId}__0` });
  window.applySearchQuery('Keep OR absent', { scrollAfterUpdate: false });
  assert.deepEqual(Array.from(document.querySelectorAll('#videoList [data-video-key]')), cards);
  assert.equal(widthUpdates, 0);
  assert.equal(document.activeElement, title);
  assert.equal(document.getElementById('searchInput').value, 'Keep OR absent');
  assert.equal(document.getElementById('mobileSearchInput').value, 'Keep OR absent');
  assert.equal(document.getElementById('clearSearchInput').classList.contains('hidden'), false);
  assert.match(document.getElementById('activeTagChipsInner').textContent, /YouTube/);
  assert.match(document.getElementById('songCount').textContent, /2\D+2/);
  assert.equal(notifications, 2, 'list-update consumers are notified even when cards are reused');
  assert.equal(scrollRequests.length, 1);
  assert.equal(scrollRequests[0].sourceVideoKey, `${firstId}__0`);

  window.applySearchQuery('Alpha', { scrollAfterUpdate: false });
  assert.equal(widthUpdates, 1);
  assert.deepEqual(app.visibleKeys(), [`${firstId}__0`]);
  assert.notEqual(document.querySelector('#videoList [data-video-key]'), cards[0]);
  assert.equal(document.activeElement, document.querySelector('#videoList .video-title'));
});

test('tag changes refresh card state even when the same rows remain visible', async t => {
  const app = await createAppFixture(t, [videoRow(firstId, { '担当区分': 'VOCAL', '3D': 'TRUE' })]);
  const { window, document } = app;
  const originalCard = document.querySelector('#videoList [data-video-key]');
  window.FilterState.setTagState('role', 'VOCAL', 'include');
  window.applyFilters({ scrollAfterUpdate: false });
  const includedCard = document.querySelector('#videoList [data-video-key]');
  assert.notEqual(includedCard, originalCard);
  assert.match(includedCard.querySelector('[data-filter-value="VOCAL"]').getAttribute('aria-label'), /選択中/);
  assert.deepEqual(app.visibleKeys(), [`${firstId}__0`]);

  window.FilterState.setTagState('role', 'VOCAL', 'none');
  window.FilterState.setTagState('format', '3D', 'include');
  window.applyFilters({ scrollAfterUpdate: false });
  const flagCard = document.querySelector('#videoList [data-video-key]');
  assert.notEqual(flagCard, includedCard);
  assert.equal(flagCard.querySelector('[data-filter-value="VOCAL"]').getAttribute('aria-label'), null);
  assert.match(flagCard.querySelector('[data-filter-value="3D"]').getAttribute('aria-label'), /選択中/);

  window.FilterState.setTagState('role', 'DANCE', 'exclude');
  window.applyFilters({ scrollAfterUpdate: false });
  assert.notEqual(document.querySelector('#videoList [data-video-key]'), flagCard);
  assert.deepEqual(app.visibleKeys(), [`${firstId}__0`]);
  assert.match(document.getElementById('activeTagChipsInner').textContent, /DANCE/);
  window.resetAllFilters();
  assert.equal(document.querySelector('#videoList [data-filter-value="3D"]').getAttribute('aria-label'), null);
  assert.equal(document.getElementById('activeTagChipsInner').textContent, '');
});

test('same-count result replacements and sorting rebuild cards and preserve playback order', async t => {
  const app = await createAppFixture(t, [
    videoRow(firstId, { title: 'Keep Zulu' }),
    videoRow(secondId, { title: 'Keep Alpha' }),
    videoRow(thirdId, { title: 'Other' })
  ]);
  const { window, document } = app;
  window.applySearchQuery('Zulu', { scrollAfterUpdate: false });
  const firstCard = document.querySelector('#videoList [data-video-key]');
  window.applySearchQuery('Other', { scrollAfterUpdate: false });
  assert.notEqual(document.querySelector('#videoList [data-video-key]'), firstCard);
  assert.deepEqual(app.visibleKeys(), [`${thirdId}__0`]);
  window.applySearchQuery('Keep', { scrollAfterUpdate: false });
  window.FilterState.setState({ sortOrder: 'title' });
  window.applyFilters({ scrollAfterUpdate: false });
  assert.deepEqual(app.visibleKeys(), [`${secondId}__0`, `${firstId}__0`]);
  assert.deepEqual(Array.from(window.currentFilteredVideos, window.getVideoKey), app.visibleKeys());
  app.youtube.ready();
  app.play(`${secondId}__0`);
  window.applySearchQuery('Keep OR missing', { scrollAfterUpdate: false });
  assert.equal(document.querySelector('#videoList .playing').dataset.videoKey, `${secondId}__0`);
  document.getElementById('nextVideoBtn').click();
  assert.equal(window.nowPlayingKey, `${firstId}__0`);
});

test('data reloads with existing keys refresh metadata and total counts', async t => {
  const rows = [videoRow(firstId, { title: 'Original' })];
  const app = await createAppFixture(t, rows);
  const originalCard = app.document.querySelector('#videoList [data-video-key]');
  rows[0].title = 'Updated';
  await app.window.loadVideoData();
  const updatedCard = app.document.querySelector('#videoList [data-video-key]');
  assert.notEqual(updatedCard, originalCard);
  assert.match(updatedCard.textContent, /Updated/);
  rows.push(videoRow(secondId, { title: 'New' }));
  await app.window.loadVideoData();
  assert.match(app.document.getElementById('songCount').textContent, /2\D+2/);
  assert.deepEqual(Array.from(app.window.currentFilteredVideos, app.window.getVideoKey), app.visibleKeys());
});

test('reused cards keep playback highlighting and refresh autoplay notices', async t => {
  const app = await createAppFixture(t, [videoRow(tiktokId, { platform: 'TikTok' })]);
  const { window, document } = app;
  const card = document.querySelector('#videoList [data-video-key]');
  app.play(`${tiktokId}__0`);
  window.applySearchQuery('TikTok', { scrollAfterUpdate: false });
  assert.equal(document.querySelector('#videoList [data-video-key]'), card);
  assert.equal(card.classList.contains('playing'), true);
  document.getElementById('repeatModeBtn').click();
  document.getElementById('randomModeBtn').click();
  window.applyFilters({ scrollAfterUpdate: false });
  assert.ok(document.getElementById('autoPlayNotice'));
  assert.equal(document.querySelector('#videoList [data-video-key]'), card);
  document.getElementById('randomModeBtn').click();
  window.applyFilters({ scrollAfterUpdate: false });
  assert.equal(document.getElementById('autoPlayNotice'), null);
  document.getElementById('closePlayerBtn').click();
  window.applyFilters({ scrollAfterUpdate: false });
  assert.equal(document.querySelector('#videoList [data-video-key]'), card);
  assert.equal(card.classList.contains('playing'), false);
});

test('empty results still update search controls and recover to the full list', async t => {
  const app = await createAppFixture(t, [videoRow(firstId)]);
  app.window.applySearchQuery('absent one', { scrollAfterUpdate: false });
  app.window.applySearchQuery('absent two', { scrollAfterUpdate: false });
  assert.deepEqual(app.visibleKeys(), []);
  assert.equal(app.document.getElementById('searchInput').value, 'absent two');
  assert.equal(app.document.getElementById('clearSearchInput').classList.contains('hidden'), false);
  assert.match(app.document.getElementById('songCount').textContent, /1\D+0/);
  app.window.clearSearchQuery({ scrollAfterUpdate: false });
  assert.deepEqual(app.visibleKeys(), [`${firstId}__0`]);
  assert.equal(app.document.getElementById('clearSearchInput').classList.contains('hidden'), true);
  assert.equal(app.document.getElementById('activeTagChipsInner').textContent, '');
});

test('member disclosure and explicit collab-order renders are not hidden by card reuse', async t => {
  const app = await createAppFixture(t, [videoRow(firstId, {
    title: 'Keep', 'コラボライバー': 'Member A,Member B', 'コラボユニット': 'Unit'
  })]);
  const { window, document } = app;
  const card = document.querySelector('#videoList [data-video-key]');
  const toggle = card.querySelector('.collab-member-toggle');
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  window.applySearchQuery('Keep', { scrollAfterUpdate: false });
  const refreshed = document.querySelector('#videoList [data-video-key]');
  assert.notEqual(refreshed, card);
  assert.equal(refreshed.querySelector('.collab-member-toggle').getAttribute('aria-expanded'), 'false');
  window.isCollabTagOrderReady = true;
  window.sortCollabTagValues = values => [...values].reverse();
  window.dispatchEvent(new window.CustomEvent('collabTagOrderReady'));
  const reordered = document.querySelector('#videoList [data-video-key]');
  assert.notEqual(reordered, refreshed);
  assert.deepEqual(Array.from(reordered.querySelectorAll('[data-collab-member]'), tag => tag.dataset.filterValue),
    ['Member B', 'Member A']);
});

test('rendered filters, previous/next and random playback use the same visible rows', async t => {
  const app = await createAppFixture(t, [
    videoRow(firstId, { title: 'Keep A', '担当区分': 'VOCAL' }),
    videoRow(secondId, { title: 'Keep B', '担当区分': 'VOCAL' }),
    videoRow(thirdId, { title: 'Keep hidden', '担当区分': 'DANCE' }),
    videoRow('ddddddddddd', { title: 'Other', '担当区分': 'VOCAL' })
  ]);
  const { window, document, youtube } = app;
  youtube.ready();
  app.play(`${firstId}__0`);
  document.getElementById('randomModeBtn').click();
  document.getElementById('nextVideoBtn').click();

  window.FilterState.setState({ searchQuery: 'Keep', exclude: { role: ['DANCE'] } });
  window.applyFilters({ scrollAfterUpdate: false });
  assert.deepEqual(app.visibleKeys(), [`${firstId}__0`, `${secondId}__0`]);
  assert.deepEqual(Array.from(window.currentFilteredVideos, window.getVideoKey), app.visibleKeys());
  assert.match(document.getElementById('songCount').textContent, /4\D+2/);
  app.play(`${firstId}__0`);
  document.getElementById('nextVideoBtn').click();
  assert.equal(window.nowPlayingKey, `${secondId}__0`);

  document.getElementById('randomModeBtn').click();
  document.getElementById('prevVideoBtn').click();
  assert.equal(window.nowPlayingKey, `${firstId}__0`);
  document.getElementById('nextVideoBtn').click();
  assert.equal(window.nowPlayingKey, `${secondId}__0`);

  window.applySearchQuery('no matching song', { scrollAfterUpdate: false });
  const commandsBefore = youtube.commands.length;
  document.getElementById('randomPlayButton').click();
  document.getElementById('nextVideoBtn').click();
  assert.deepEqual(app.visibleKeys(), []);
  assert.equal(youtube.commands.length, commandsBefore);
});

test('YouTube readiness executes only the latest selected row, including its start time', async t => {
  const app = await createAppFixture(t, [videoRow(firstId), videoRow(firstId, { start: '1:30' })]);
  app.play(`${firstId}__0`);
  app.play(`${firstId}__90`);
  assert.deepEqual(app.youtube.commands, []);
  app.youtube.ready();
  app.youtube.ready();
  assert.deepEqual(app.youtube.commands, [{ type: 'load', videoId: firstId, startSeconds: 90 }]);
  assert.equal(app.window.nowPlayingKey, `${firstId}__90`);
});

for (const cancelBy of ['close', 'tiktok']) {
  test(`pending YouTube playback is cancelled by ${cancelBy}`, async t => {
    const app = await createAppFixture(t, [videoRow(firstId), videoRow(tiktokId, { platform: 'TikTok' })]);
    app.play(`${firstId}__0`);
    if (cancelBy === 'close') app.document.getElementById('closePlayerBtn').click();
    else app.play(`${tiktokId}__0`);
    app.youtube.ready();
    assert.equal(app.youtube.commands.some(command => command.type === 'load' || command.type === 'cue'), false);
    assert.equal(app.window.nowPlayingKey, cancelBy === 'close' ? null : `${tiktokId}__0`);
    assert.equal(app.activeMonitorCount(), 0);
  });
}

test('automatic next skips TikTok and still respects manual-play mode', async t => {
  const app = await createAppFixture(t, [
    videoRow(firstId), videoRow(tiktokId, { platform: 'TikTok' }), videoRow(secondId)
  ], { storage: { playerRepeatMode: 'all', manualPlayTestMode: '1' } });
  app.youtube.ready();
  app.play(`${firstId}__0`);
  app.youtube.emitState(app.window.YT.PlayerState.ENDED);
  assert.equal(app.window.nowPlayingKey, `${secondId}__0`);
  assert.deepEqual(app.youtube.commands.filter(command => command.type === 'cue').map(command => command.videoId), [firstId, secondId]);
  assert.equal(app.youtube.commands.some(command => command.type === 'load'), false);
});

test('random previous restores history even when the row is filtered out', async t => {
  const app = await createAppFixture(t, [videoRow(firstId), videoRow(secondId)]);
  app.youtube.ready();
  app.play(`${firstId}__0`);
  app.document.getElementById('randomModeBtn').click();
  app.document.getElementById('nextVideoBtn').click();
  app.window.applySearchQuery(secondId, { scrollAfterUpdate: false });
  app.document.getElementById('prevVideoBtn').click();
  assert.equal(app.window.nowPlayingKey, `${firstId}__0`);
  assert.deepEqual(app.visibleKeys(), [`${secondId}__0`]);
  assert.ok(app.document.getElementById('nowPlayingFilteredOutNotice'));
});

test('mobile tag changes apply once and closing preserves the result', async t => {
  const app = await createAppFixture(t, [videoRow(firstId, { '担当区分': 'VOCAL' }), videoRow(secondId, { '担当区分': 'DANCE' })]);
  let renders = 0;
  app.document.getElementById('openFilterModal').click();
  app.window.addEventListener('videoListRendered', () => { renders++; });
  app.document.querySelector('#modalRoleTags [data-filter-value="VOCAL"]').click();
  await app.flushFrames();
  assert.deepEqual(app.visibleKeys(), [`${firstId}__0`]);
  assert.equal(renders, 1);
  assert.equal(app.document.getElementById('modalResultVisible').textContent, '1');
  app.document.getElementById('applyFilters').click();
  await app.flushFrames();
  assert.equal(renders, 1);
  assert.deepEqual(app.visibleKeys(), [`${firstId}__0`]);
});

test('end countdown advances once and closing stops all playback monitors', async t => {
  const app = await createAppFixture(t, [videoRow(firstId, { end: 12 }), videoRow(secondId, { end: 60 })], {
    storage: { playerRepeatMode: 'all' }
  });
  app.youtube.ready();
  app.play(`${firstId}__0`);
  app.sampleTime(11);
  assert.equal(app.document.getElementById('endCountdownTime').textContent, '1秒');
  app.sampleTime(12);
  assert.equal(app.window.nowPlayingKey, `${secondId}__0`);
  assert.equal(app.youtube.commands.filter(command => command.type === 'load').length, 2);
  assert.equal(app.activeMonitorCount(), 1);
  app.document.getElementById('closePlayerBtn').click();
  assert.equal(app.activeMonitorCount(), 0);
  app.sampleTime(70, 10000);
  assert.equal(app.window.nowPlayingKey, null);
});

test('stale time after switching rows starts a grace period and seeking back resets it', async t => {
  const app = await createAppFixture(t, [videoRow(firstId, { end: 50 }), videoRow(firstId, { start: 10, end: 20 })], {
    storage: { playerRepeatMode: 'all' }
  });
  app.youtube.ready();
  app.play(`${firstId}__0`);
  app.sampleTime(40);
  app.play(`${firstId}__10`);
  assert.equal(app.window.nowPlayingKey, `${firstId}__10`);
  assert.equal(app.document.getElementById('endCountdownTime').textContent, '10秒');
  app.sampleTime(40, 9000);
  assert.equal(app.document.getElementById('endCountdownTime').textContent, '1秒');
  app.sampleTime(15, 500);
  assert.equal(app.document.getElementById('endCountdownTime').textContent, '5秒');
  app.sampleTime(15, 1000);
  assert.equal(app.window.nowPlayingKey, `${firstId}__10`);
  assert.equal(app.document.getElementById('endCountdownTime').textContent, '5秒');
});

test('seeking beyond end advances only after grace; keep-playing cancels that row only', async t => {
  const app = await createAppFixture(t, [videoRow(firstId, { end: 20 }), videoRow(secondId, { end: 60 })], {
    storage: { playerRepeatMode: 'all' }
  });
  app.youtube.ready();
  app.play(`${firstId}__0`);
  app.sampleTime(30);
  app.sampleTime(30, 9999);
  assert.equal(app.window.nowPlayingKey, `${firstId}__0`);
  app.sampleTime(30, 1);
  assert.equal(app.window.nowPlayingKey, `${secondId}__0`);

  app.sampleTime(55);
  app.document.getElementById('endCountdownKeepBtn').click();
  app.sampleTime(61, 20000);
  assert.equal(app.window.nowPlayingKey, `${secondId}__0`);
  assert.equal(app.window.getRepeatMode(), 'all');
  app.youtube.emitState(app.window.YT.PlayerState.ENDED);
  assert.equal(app.window.nowPlayingKey, `${firstId}__0`);
});

test('changing repeat mode clears grace and re-enabling all starts a fresh countdown', async t => {
  const app = await createAppFixture(t, [videoRow(firstId, { end: 20 }), videoRow(secondId)], {
    storage: { playerRepeatMode: 'all' }
  });
  app.youtube.ready();
  app.play(`${firstId}__0`);
  app.sampleTime(30);
  app.sampleTime(30, 9000);
  app.document.getElementById('repeatModeBtn').click();
  assert.equal(app.window.getRepeatMode(), 'one');
  assert.equal(app.activeMonitorCount(), 0);
  assert.equal(app.document.getElementById('endCountdownControls').classList.contains('hidden'), true);
  app.sampleTime(30, 20000);
  assert.equal(app.window.nowPlayingKey, `${firstId}__0`);
  app.document.getElementById('repeatModeBtn').click();
  app.document.getElementById('repeatModeBtn').click();
  assert.equal(app.window.getRepeatMode(), 'all');
  assert.equal(app.document.getElementById('endCountdownTime').textContent, '10秒');
});
