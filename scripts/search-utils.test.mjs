import assert from 'node:assert/strict';
import test from 'node:test';

import { loadBrowserScript, toPlain } from './browser-script-test-utils.mjs';

function createSearchUtils() {
  return loadBrowserScript('search-utils.js').SearchUtils;
}

function createVideo(searchText) {
  return { _searchText: String(searchText || '').toLowerCase() };
}

test('空欄検索はすべての動画に一致する', () => {
  const searchUtils = createSearchUtils();

  assert.equal(searchUtils.matchesSearchQuery(createVideo('VOCAL 3D'), ''), true);
  assert.equal(searchUtils.matchesSearchQuery(createVideo('VOCAL 3D'), '   '), true);
});

test('空白区切りとAND演算子はすべての語を要求する', () => {
  const searchUtils = createSearchUtils();
  const parsed = searchUtils.parseSearchQuery('VOCAL AND 3D');

  assert.deepEqual(toPlain(parsed), {
    excludeTerms: [],
    groups: [['vocal', '3d']]
  });
  assert.equal(searchUtils.matchesParsedSearchQuery(createVideo('VOCAL 3D 歌枠'), parsed), true);
  assert.equal(searchUtils.matchesParsedSearchQuery(createVideo('VOCAL Shorts'), parsed), false);
});

test('OR演算子は語句グループのどれかに一致すればよい', () => {
  const searchUtils = createSearchUtils();
  const parsed = searchUtils.parseSearchQuery('VOCAL 3D OR DANCE Shorts');

  assert.deepEqual(toPlain(parsed.groups), [
    ['vocal', '3d'],
    ['dance', 'shorts']
  ]);
  assert.equal(searchUtils.matchesParsedSearchQuery(createVideo('VOCAL 3D Full'), parsed), true);
  assert.equal(searchUtils.matchesParsedSearchQuery(createVideo('DANCE Shorts'), parsed), true);
  assert.equal(searchUtils.matchesParsedSearchQuery(createVideo('VOCAL Shorts'), parsed), false);
});

test('マイナス付き検索語は一致動画を除外する', () => {
  const searchUtils = createSearchUtils();
  const parsed = searchUtils.parseSearchQuery('VOCAL -Shorts');

  assert.deepEqual(toPlain(parsed), {
    excludeTerms: ['shorts'],
    groups: [['vocal']]
  });
  assert.equal(searchUtils.matchesParsedSearchQuery(createVideo('VOCAL Full'), parsed), true);
  assert.equal(searchUtils.matchesParsedSearchQuery(createVideo('VOCAL Shorts'), parsed), false);
  assert.equal(searchUtils.matchesSearchQuery(createVideo('DANCE Full'), '-Shorts'), true);
  assert.equal(searchUtils.matchesSearchQuery(createVideo('DANCE Shorts'), '-Shorts'), false);
});

test('演算子と検索語は大文字小文字を区別しない', () => {
  const searchUtils = createSearchUtils();

  assert.equal(searchUtils.matchesSearchQuery(createVideo('vocal dance'), 'VoCaL or PIANO'), true);
  assert.equal(searchUtils.matchesSearchQuery(createVideo('piano solo'), 'vocal OR PiAnO'), true);
});
