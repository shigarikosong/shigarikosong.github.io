import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { loadBrowserScript, toPlain } from './browser-script-test-utils.mjs';

function createVideoNormalizer() {
  return loadBrowserScript('video-normalizer.js', {
    DATE_UTILS: {
      parseYmdToTime(value) {
        return value ? 123456789 : 0;
      }
    },
    TAG_CONFIG: {
      getPlatformLabel(value) {
        return value === 'youtube' ? 'YouTube' : value === 'tiktok' ? 'TikTok' : value;
      }
    }
  }).VideoNormalizer;
}

test('秒数と時刻文字列を再生秒へ変換する', () => {
  const normalizer = createVideoNormalizer();

  assert.equal(normalizer.parseTimeToSeconds(2894), 2894);
  assert.equal(normalizer.parseTimeToSeconds('2894.9'), 2894);
  assert.equal(normalizer.parseTimeToSeconds('48:14'), 2894);
  assert.equal(normalizer.parseTimeToSeconds('1:02:03'), 3723);
  assert.equal(normalizer.parseTimeToSeconds('1:60', null), null);
  assert.equal(normalizer.parseTimeToSeconds('', 0), 0);
});

test('動画データを既存の内部フィールドへ正規化する', () => {
  const normalizer = createVideoNormalizer();
  const source = {
    number: 12,
    full_number: ' 34 ',
    full_button_text: '  3D ver.を再生  ',
    player_aspect: ' 9:16 ',
    title: 'テスト曲',
    title_kana: 'てすときょく',
    artist: 'テスト Artist',
    artist_kana: 'てすとあーてぃすと',
    waku_name: 'テスト配信',
    'カテゴリ': 'コラボ',
    platform: ' YouTube ',
    '動画種別': 'Full, イラスト',
    '担当区分': 'VOCAL, DANCE',
    'コラボライバー': '倉持めると, 石神のぞみ',
    'コラボユニット': 'ユニット名',
    '3D': 'TRUE',
    Shorts: 'TRUE',
    start: '1:02',
    end: '1:12',
    '公開日': '2026-08-26'
  };

  const normalized = normalizer.normalizeVideo(source);

  assert.equal(normalized, source);
  assert.deepEqual(toPlain(normalized._roles), ['VOCAL', 'DANCE']);
  assert.deepEqual(toPlain(normalized._types), ['Full', 'イラスト']);
  assert.deepEqual(toPlain(normalized._collabLivers), ['倉持めると', '石神のぞみ']);
  assert.deepEqual(toPlain(normalized._collabUnits), ['ユニット名']);
  assert.deepEqual(toPlain(normalized._collabTags), ['倉持めると', '石神のぞみ', 'ユニット名']);
  assert.equal(normalized._platform, 'youtube');
  assert.equal(normalized._number, '12');
  assert.equal(normalized._fullNumber, '34');
  assert.equal(normalized._fullButtonText, '3D ver.を再生');
  assert.equal(normalized._playerAspect, '9:16');
  assert.equal(normalized._is3D, true);
  assert.equal(normalized._isShorts, true);
  assert.equal(normalized._startSeconds, 62);
  assert.equal(normalized._endSeconds, 72);
  assert.equal(normalized._time, 123456789);
  assert.match(normalized._searchText, /テスト曲/);
  assert.match(normalized._searchText, /youtube/);
  assert.match(normalized._searchText, /倉持めると/);
});

test('空欄・無効値は既存の初期値へ正規化する', () => {
  const normalizer = createVideoNormalizer();
  const videos = [{
    number: null,
    full_number: '   ',
    full_button_text: undefined,
    player_aspect: '4:3',
    platform: 'TikTok',
    '担当区分': ' VOCAL, , ',
    '動画種別': '',
    '3D': 'true',
    Shorts: false,
    start: 'invalid',
    end: '0',
    '公開月': '2026-08'
  }];

  const normalized = normalizer.normalizeVideos(videos);

  assert.equal(normalized[0], videos[0]);
  assert.deepEqual(toPlain(normalized[0]._roles), ['VOCAL']);
  assert.deepEqual(toPlain(normalized[0]._types), []);
  assert.equal(normalized[0]._platform, 'tiktok');
  assert.equal(normalized[0]._number, '');
  assert.equal(normalized[0]._fullNumber, '');
  assert.equal(normalized[0]._fullButtonText, '');
  assert.equal(normalized[0]._playerAspect, '');
  assert.equal(normalized[0]._is3D, false);
  assert.equal(normalized[0]._isShorts, false);
  assert.equal(normalized[0]._startSeconds, 0);
  assert.equal(normalized[0]._endSeconds, null);
});

test('現在の動画JSONを全件正規化できる', () => {
  const normalizer = createVideoNormalizer();
  const videos = JSON.parse(fs.readFileSync(
    new URL('../data/videos.json', import.meta.url),
    'utf8'
  ));

  const normalized = normalizer.normalizeVideos(videos);

  assert.equal(normalized.length, videos.length);
  assert.ok(normalized.length > 0);
  assert.ok(normalized.every(video => Array.isArray(video._roles)));
  assert.ok(normalized.every(video => Array.isArray(video._types)));
  assert.ok(normalized.every(video => Array.isArray(video._collabTags)));
  assert.ok(normalized.every(video => typeof video._searchText === 'string'));
  assert.ok(normalized.every(video => Number.isFinite(video._startSeconds)));
  assert.ok(normalized.every(video => (
    video._endSeconds === null || Number.isFinite(video._endSeconds)
  )));
});
