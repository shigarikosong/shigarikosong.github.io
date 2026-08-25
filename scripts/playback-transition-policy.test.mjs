import assert from 'node:assert/strict';
import test from 'node:test';

import { loadBrowserScript, toPlain } from './browser-script-test-utils.mjs';

function createTransitionPolicy() {
  return loadBrowserScript('playback-transition-policy.js').PlaybackTransitionPolicy;
}

test('Repeat OFFでは再生終了後に遷移しない', () => {
  const policy = createTransitionPolicy();

  assert.deepEqual(toPlain(policy.getVideoEndTransition({
    repeatMode: 'off',
    randomEnabled: true
  })), {
    type: 'none',
    autoplay: false,
    autoPlayableOnly: false
  });
  assert.equal(policy.getVideoEndTransition({ repeatMode: 'unknown' }).type, 'none');
});

test('Repeat ONEはRandom設定に関係なく同じ動画を再生する', () => {
  const policy = createTransitionPolicy();

  assert.deepEqual(toPlain(policy.getVideoEndTransition({
    repeatMode: 'one',
    randomEnabled: true
  })), {
    type: 'replay',
    autoplay: true,
    autoPlayableOnly: false
  });
});

test('Repeat ALLはRandom設定に応じて順番またはランダム遷移する', () => {
  const policy = createTransitionPolicy();

  assert.deepEqual(toPlain(policy.getVideoEndTransition({
    repeatMode: 'all',
    randomEnabled: false
  })), {
    type: 'next',
    autoplay: true,
    autoPlayableOnly: true
  });
  assert.deepEqual(toPlain(policy.getVideoEndTransition({
    repeatMode: 'all',
    randomEnabled: true
  })), {
    type: 'random',
    autoplay: true,
    autoPlayableOnly: true
  });
});

test('自動連続再生ではTikTokを除外する', () => {
  const policy = createTransitionPolicy();

  assert.equal(policy.isAutoPlayableVideo({ _platform: 'youtube' }), true);
  assert.equal(policy.isAutoPlayableVideo({ platform: 'YouTube' }), true);
  assert.equal(policy.isAutoPlayableVideo({ _platform: 'tiktok' }), false);
  assert.equal(policy.isAutoPlayableVideo({ platform: 'TikTok' }), false);
});

test('手動再生モードは自動遷移のautoplay指定より優先される', () => {
  const transitionPolicy = createTransitionPolicy();
  const playbackPolicy = loadBrowserScript('playback-policy.js').PlaybackPolicy;
  const transition = transitionPolicy.getVideoEndTransition({
    repeatMode: 'all',
    randomEnabled: false
  });

  assert.equal(playbackPolicy.shouldCueYouTubeVideo({
    autoplay: transition.autoplay,
    manualPlayEnabled: false
  }), false);
  assert.equal(playbackPolicy.shouldCueYouTubeVideo({
    autoplay: transition.autoplay,
    manualPlayEnabled: true
  }), true);
});
