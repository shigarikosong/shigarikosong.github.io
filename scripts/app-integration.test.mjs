import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppFixture, videoRow } from './app-test-fixture.mjs';

const firstId = 'aaaaaaaaaaa';
const secondId = 'bbbbbbbbbbb';
const thirdId = 'ccccccccccc';
const tiktokId = '7123456789012345678';

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
