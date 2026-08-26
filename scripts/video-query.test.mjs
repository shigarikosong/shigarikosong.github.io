import assert from 'node:assert/strict';
import test from 'node:test';

import { loadBrowserScript, toPlain } from './browser-script-test-utils.mjs';

function createVideoQuery() {
  return loadBrowserScript('video-query.js', {
    SearchUtils: {
      matchesParsedSearchQuery(video, parsedQuery) {
        return !parsedQuery?.term || video._searchText.includes(parsedQuery.term);
      }
    },
    DATE_UTILS: {
      getDateFilterMatch(selectedDate, videoTime, now) {
        if (!selectedDate) return true;
        return selectedDate === 'recent' && videoTime >= now.getTime() - 100;
      }
    }
  }).VideoQuery;
}

function createFilterState(include = {}) {
  return {
    include: {
      category: '',
      collab: [],
      role: [],
      platform: '',
      date: '',
      flag: [],
      format: [],
      ...include
    }
  };
}

function createVideo(id, overrides = {}) {
  return {
    id,
    title: id,
    artist: '',
    'カテゴリ': 'ソロ',
    _collabTags: [],
    _roles: [],
    _types: [],
    _platform: 'youtube',
    _time: 1000,
    _is3D: false,
    _isShorts: false,
    _searchText: id.toLowerCase(),
    ...overrides
  };
}

test('異なるグループはAND、CollabとRiko Partの各グループ内はORで判定する', () => {
  const query = createVideoQuery();
  const videos = [
    createVideo('match', {
      'カテゴリ': 'コラボ',
      _collabTags: ['倉持めると'],
      _roles: ['VOCAL']
    }),
    createVideo('wrong-collab', {
      'カテゴリ': 'コラボ',
      _collabTags: ['ソフィア・ヴァレンタイン'],
      _roles: ['VOCAL']
    }),
    createVideo('wrong-role', {
      'カテゴリ': 'コラボ',
      _collabTags: ['石神のぞみ'],
      _roles: ['MOVIE']
    })
  ];

  const result = query.filterAndSortVideos(videos, {
    filterState: createFilterState({
      category: 'コラボ',
      collab: ['倉持めると', '石神のぞみ'],
      role: ['VOCAL', 'DANCE']
    }),
    parsedSearchQuery: {},
    now: new Date(1000),
    order: 'desc'
  });

  assert.deepEqual(toPlain(result).map(video => video.id), ['match']);
});

test('FormatはAND、3DとShortsを含む条件はそれぞれ必須にする', () => {
  const query = createVideoQuery();
  const videos = [
    createVideo('match', {
      _types: ['Full', 'イラスト'],
      _is3D: true,
      _isShorts: true
    }),
    createVideo('missing-format', {
      _types: ['Full'],
      _is3D: true,
      _isShorts: true
    }),
    createVideo('missing-flag', {
      _types: ['Full', 'イラスト'],
      _is3D: true
    })
  ];

  const result = query.filterAndSortVideos(videos, {
    filterState: createFilterState({
      format: ['Full', 'イラスト'],
      flag: ['3D', 'Shorts']
    }),
    parsedSearchQuery: {},
    now: new Date(1000),
    order: 'desc'
  });

  assert.deepEqual(toPlain(result).map(video => video.id), ['match']);
});

test('検索・Platform・日付条件をすべて満たす動画だけを残す', () => {
  const query = createVideoQuery();
  const now = new Date(1000);
  const videos = [
    createVideo('match', { _searchText: 'target', _time: 950 }),
    createVideo('wrong-search', { _searchText: 'other', _time: 950 }),
    createVideo('wrong-platform', { _searchText: 'target', _platform: 'tiktok', _time: 950 }),
    createVideo('too-old', { _searchText: 'target', _time: 800 })
  ];

  const result = query.filterAndSortVideos(videos, {
    filterState: createFilterState({ platform: 'youtube', date: 'recent' }),
    parsedSearchQuery: { term: 'target' },
    now,
    order: 'desc'
  });

  assert.deepEqual(toPlain(result).map(video => video.id), ['match']);
});

test('公開日・曲名・アーティスト順で並べ、入力配列は変更しない', () => {
  const query = createVideoQuery();
  const videos = [
    createVideo('second', { title: 'い曲', artist: 'あ歌手', _time: 200 }),
    createVideo('first', { title: 'あ曲', artist: 'い歌手', _time: 100 })
  ];
  const originalOrder = videos.map(video => video.id);
  const options = {
    filterState: createFilterState(),
    parsedSearchQuery: {},
    now: new Date(1000)
  };

  assert.deepEqual(
    toPlain(query.filterAndSortVideos(videos, { ...options, order: 'asc' })).map(video => video.id),
    ['first', 'second']
  );
  assert.deepEqual(
    toPlain(query.filterAndSortVideos(videos, { ...options, order: 'desc' })).map(video => video.id),
    ['second', 'first']
  );
  assert.deepEqual(
    toPlain(query.filterAndSortVideos(videos, { ...options, order: 'title' })).map(video => video.id),
    ['first', 'second']
  );
  assert.deepEqual(
    toPlain(query.filterAndSortVideos(videos, { ...options, order: 'artist' })).map(video => video.id),
    ['second', 'first']
  );
  assert.deepEqual(videos.map(video => video.id), originalOrder);
});
