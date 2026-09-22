import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBrowserScripts, toPlain } from './browser-script-test-utils.mjs';

function codec() {
  return loadBrowserScripts(['tag-config.js', 'filter-share-url.js'], { URL, URLSearchParams }).FilterShareUrl;
}

test('default and whitespace-only conditions omit the fragment', () => {
  const api = codec();
  assert.equal(api.serialize(api.emptyState()), '');
  assert.equal(api.serialize({ ...api.emptyState(), searchQuery: ' \n ' }), '');
  assert.equal(api.createUrl(api.emptyState(), 'https://site.test/archive/?manualPlay=1#other'), 'https://site.test/archive/');
});

test('all shared conditions round-trip, including Japanese, operators and URL punctuation', () => {
  const api = codec();
  const state = api.emptyState();
  state.searchQuery = ' アイドル AND "A&B" OR +100% #歌 -Shorts ';
  state.sortOrder = 'artist';
  state.include = { category: 'コラボ', platform: 'youtube', date: 'year', format: ['歌枠'], role: ['DANCE', 'VOCAL'], collab: ['A,B', '倉持めると'], flag: ['3D'] };
  state.exclude = { category: ['ソロ'], platform: ['tiktok'], date: ['old'], format: ['企画'], role: ['CHORUS'], collab: ['Unit & A'], flag: ['Shorts'] };
  const hash = api.serialize(state);
  assert.ok(hash.startsWith('#filters=1&'));
  assert.deepEqual(toPlain(api.parse(hash)), { kind: 'shared', state: toPlain(state) });
  assert.equal(api.serialize(api.parse(hash).state), hash);
});

test('tag order and duplicates produce one stable URL; only filter state is included', () => {
  const api = codec();
  const a = api.emptyState();
  a.include.collab = ['B', 'A', 'B'];
  a.numberInspection = true;
  a.nowPlayingKey = 'private-key';
  const b = api.emptyState();
  b.include.collab = ['A', 'B'];
  assert.equal(api.serialize(a), api.serialize(b));
  const url = api.createUrl(a, 'https://preview.test/subdir/?manualPlay=1&utm_source=test#old');
  assert.equal(new URL(url).origin, 'https://preview.test');
  assert.equal(new URL(url).pathname, '/subdir/');
  assert.equal(new URL(url).search, '');
  assert.doesNotMatch(url, /manualPlay|numberInspection|private-key|utm_source/);
});

test('empty and unrelated fragments are distinguished from shared conditions', () => {
  const api = codec();
  assert.equal(api.parse('').kind, 'empty');
  assert.equal(api.parse('#').kind, 'empty');
  assert.equal(api.parse('#videoList').kind, 'unrelated');
  assert.equal(api.parse('#q=hello').kind, 'unrelated');
  assert.deepEqual(toPlain(api.parse('#filters=1').state), toPlain(api.emptyState()));
});

test('malformed, ambiguous and unsupported fragments reject the whole state', () => {
  const api = codec();
  for (const hash of [
    '#filters=2', '#filters=1&filters=1', '#filters=1&q=%ZZ', '#filters=1&q=%E0%A4',
    '#filters=1&q=a&q=b', '#filters=1&sort=invalid', '#filters=1&sort=asc&sort=desc',
    '#filters=1&in.category=A&in.category=B', '#filters=1&in.platform=other',
    '#filters=1&in.date=last-week', '#filters=1&out.flag=other', '#filters=1&in.collab=',
    '#filters=1&in.collab.extra=A', '#filters=1&in.__proto__=A', '#filters=1&autoplay=1',
    `#filters=1&q=${'a'.repeat(16000)}`
  ]) assert.equal(api.parse(hash).kind, 'invalid', hash.slice(0, 80));
});

test('removed data-defined tags remain explicit conditions, not silently dropped', () => {
  const api = codec();
  const parsed = api.parse('#filters=1&in.collab=OldMember&in.format=OldFormat&out.role=OldRole');
  assert.equal(parsed.kind, 'shared');
  assert.deepEqual(toPlain(parsed.state.include.collab), ['OldMember']);
  assert.deepEqual(toPlain(parsed.state.include.format), ['OldFormat']);
  assert.deepEqual(toPlain(parsed.state.exclude.role), ['OldRole']);
});

test('oversized conditions fail rather than copying a truncated URL', () => {
  const api = codec();
  assert.throws(() => api.serialize({ ...api.emptyState(), searchQuery: 'あ'.repeat(2000) }), /too long/);
});
