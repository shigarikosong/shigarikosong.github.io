import assert from 'node:assert/strict';
import test from 'node:test';

import { loadBrowserScript, toPlain } from './browser-script-test-utils.mjs';

const context = loadBrowserScript('player-size-policy.js');
const policy = context.PlayerSizePolicy;

test('動画属性から通常・Shorts・TikTokのレイアウトを選ぶ', () => {
  assert.equal(policy.resolveLayout({}), policy.LAYOUT_LANDSCAPE);
  assert.equal(policy.resolveLayout({ isShorts: true }), policy.LAYOUT_SHORTS);
  assert.equal(
    policy.resolveLayout({ isShorts: true, playerAspect: '16:9' }),
    policy.LAYOUT_LANDSCAPE
  );
  assert.equal(
    policy.resolveLayout({ playerAspect: '9:16' }),
    policy.LAYOUT_SHORTS
  );
  assert.equal(
    policy.resolveLayout({ isTikTok: true, playerAspect: '16:9' }),
    policy.LAYOUT_TIKTOK
  );
});

test('通常動画は16:9を維持し、利用可能幅でクランプする', () => {
  assert.deepEqual(
    toPlain(policy.calculateSize(360, policy.LAYOUT_LANDSCAPE, {
      width: 1000,
      height: 800
    })),
    { width: 640, height: 360 }
  );

  assert.deepEqual(
    toPlain(policy.calculateSize(360, policy.LAYOUT_LANDSCAPE, {
      width: 500,
      height: 800
    })),
    { width: 500, height: 281 }
  );
});

test('通常動画は高さ200pxより下の希望値をcompact幅として扱う', () => {
  assert.deepEqual(
    toPlain(policy.calculateSize(150, policy.LAYOUT_LANDSCAPE, {
      width: 1000,
      height: 800
    })),
    { width: 267, height: 200 }
  );

  assert.deepEqual(
    toPlain(policy.calculateSize(0, policy.LAYOUT_LANDSCAPE, {
      width: 1000,
      height: 800
    })),
    { width: 200, height: 200 }
  );
});

test('縦動画は9:16と200px幅のcompact表示を使い分ける', () => {
  assert.deepEqual(
    toPlain(policy.calculateSize(400, policy.LAYOUT_SHORTS, {
      width: 1000,
      height: 800
    })),
    { width: 225, height: 400 }
  );

  assert.deepEqual(
    toPlain(policy.calculateSize(300, policy.LAYOUT_TIKTOK, {
      width: 1000,
      height: 800
    })),
    { width: 200, height: 300 }
  );

  assert.deepEqual(
    toPlain(policy.calculateSize(0, policy.LAYOUT_SHORTS, {
      width: 1000,
      height: 800
    })),
    { width: 200, height: 200 }
  );
});

test('200pxを確保できない画面では表示領域内へ収める', () => {
  assert.deepEqual(
    toPlain(policy.calculateSize(360, policy.LAYOUT_LANDSCAPE, {
      width: 180,
      height: 500
    })),
    { width: 180, height: 200 }
  );

  assert.deepEqual(
    toPlain(policy.calculateSize(360, policy.LAYOUT_LANDSCAPE, {
      width: 500,
      height: 160
    })),
    { width: 284, height: 160 }
  );
});

test('不正な希望サイズは既定値へ戻し、最小希望値を下回らない', () => {
  assert.equal(policy.clampSizePreference('invalid'), policy.DEFAULT_SIZE_PREFERENCE);
  assert.equal(policy.clampSizePreference(0), policy.MIN_SIZE_PREFERENCE);
});
