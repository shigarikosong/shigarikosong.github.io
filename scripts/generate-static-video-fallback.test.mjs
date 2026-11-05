import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  END_MARKER,
  FALLBACK_LIMIT,
  START_MARKER,
  getVideoUrl,
  renderFallback,
  updateIndexHtml
} from './generate-static-video-fallback.mjs';

test('YouTubeの開始時刻を秒数付きURLへ変換する', () => {
  assert.equal(
    getVideoUrl({ platform: 'YouTube', videoId: 'abcdefghijk', start: '1:23:45' }),
    'https://www.youtube.com/watch?v=abcdefghijk&t=5025s'
  );
  assert.equal(
    getVideoUrl({ platform: 'YouTube', videoId: 'https://youtu.be/abcdefghijk', start: 0 }),
    'https://www.youtube.com/watch?v=abcdefghijk'
  );
});

test('静的内容をescapeし、空欄項目は出力しない', () => {
  const html = renderFallback([{
    title: '<曲名 & "引用">', artist: '', videoId: 'abcdefghijk', platform: 'YouTube',
    start: '0', '公開月': '2026-11-05', waku_name: "配信's title"
  }], 1);

  assert.match(html, /&lt;曲名 &amp; &quot;引用&quot;&gt;/);
  assert.match(html, /配信&#39;s title/);
  assert.doesNotMatch(html, /<dt>アーティスト<\/dt>/);
});

test('index.htmlの生成済み領域だけを置き換える', () => {
  const source = `before\n${START_MARKER}\nold\n${END_MARKER}\nafter`;
  const result = updateIndexHtml(source, [{
    title: '新しい曲', videoId: 'abcdefghijk', platform: 'YouTube'
  }], 1);

  assert.match(result, /^before/);
  assert.match(result, /新しい曲/);
  assert.doesNotMatch(result, /old/);
  assert.match(result, /after$/);
});

test('コミット済みindex.htmlのフォールバックが動画JSONと一致する', () => {
  const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const videos = JSON.parse(fs.readFileSync(new URL('../data/videos.json', import.meta.url), 'utf8'));
  const generated = updateIndexHtml(indexHtml, videos);
  const fallback = indexHtml.slice(
    indexHtml.indexOf(START_MARKER),
    indexHtml.indexOf(END_MARKER) + END_MARKER.length
  );

  assert.equal(indexHtml, generated);
  assert.equal((fallback.match(/<article class="static-video-entry">/g) || []).length, FALLBACK_LIMIT);
});
