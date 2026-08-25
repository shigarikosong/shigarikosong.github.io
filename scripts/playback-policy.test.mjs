import assert from 'node:assert/strict';
import test from 'node:test';

import { loadBrowserScript } from './browser-script-test-utils.mjs';

function createPlaybackPolicy() {
  return loadBrowserScript('playback-policy.js').PlaybackPolicy;
}

test('通常モードでは明示されたautoplay設定に従う', () => {
  const playbackPolicy = createPlaybackPolicy();

  assert.equal(playbackPolicy.shouldCueYouTubeVideo({}), false);
  assert.equal(playbackPolicy.shouldCueYouTubeVideo({ autoplay: true }), false);
  assert.equal(playbackPolicy.shouldCueYouTubeVideo({ autoplay: false }), true);
});

test('手動再生モードはautoplay trueより優先してcueする', () => {
  const playbackPolicy = createPlaybackPolicy();

  assert.equal(playbackPolicy.shouldCueYouTubeVideo({ manualPlayEnabled: true }), true);
  assert.equal(playbackPolicy.shouldCueYouTubeVideo({
    autoplay: true,
    manualPlayEnabled: true
  }), true);
  assert.equal(playbackPolicy.shouldCueYouTubeVideo({
    autoplay: false,
    manualPlayEnabled: true
  }), true);
});
