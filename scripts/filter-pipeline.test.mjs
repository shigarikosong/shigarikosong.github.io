import assert from 'node:assert/strict';
import test from 'node:test';

import { loadBrowserScripts, toPlain } from './browser-script-test-utils.mjs';

function createFilterPipelineFixture() {
  const elements = {
    searchInput: { value: '' },
    modalSearchInput: { value: '' },
    sortOrder: { value: 'desc' },
    modalSortOrder: { value: 'desc' }
  };
  const context = loadBrowserScripts([
    'tag-config.js',
    'date-utils.js',
    'search-utils.js',
    'video-query.js',
    'filter-state.js'
  ], {
    document: {
      getElementById(id) {
        return elements[id] || null;
      }
    }
  });

  return { context, elements };
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
    _time: 0,
    _is3D: false,
    _isShorts: false,
    _searchText: id.toLowerCase(),
    ...overrides
  };
}

function runFilterPipeline(context, videos) {
  const filterState = context.FilterState.getState();
  const parsedSearchQuery = context.SearchUtils.parseSearchQuery(filterState.searchQuery);
  const includedVideos = context.VideoQuery.filterAndSortVideos(videos, {
    filterState,
    parsedSearchQuery,
    now: new Date('2026-08-26T00:00:00Z'),
    order: filterState.sortOrder
  });

  return context.FilterState.filterExcludedVideos(includedVideos);
}

test('検索・include・excludeを公開API経由で一連適用する', () => {
  const { context } = createFilterPipelineFixture();
  const videos = [
    createVideo('excluded-collab', {
      'カテゴリ': 'コラボ',
      _collabTags: ['倉持めると', 'ソフィア・ヴァレンタイン'],
      _roles: ['VOCAL'],
      _types: ['歌枠'],
      _time: 500,
      _searchText: 'excluded collab vocal full'
    }),
    createVideo('vocal-match', {
      'カテゴリ': 'コラボ',
      _collabTags: ['倉持めると'],
      _roles: ['VOCAL'],
      _types: ['歌枠'],
      _time: 400,
      _searchText: 'vocal match full'
    }),
    createVideo('dance-match', {
      'カテゴリ': 'コラボ',
      _collabTags: ['石神のぞみ'],
      _roles: ['DANCE'],
      _types: ['歌枠'],
      _time: 300,
      _searchText: 'dance match full'
    }),
    createVideo('shorts-search-exclusion', {
      'カテゴリ': 'コラボ',
      _collabTags: ['石神のぞみ'],
      _roles: ['DANCE'],
      _types: ['歌枠', 'Shorts'],
      _time: 200,
      _isShorts: true,
      _searchText: 'dance match shorts'
    }),
    createVideo('wrong-format', {
      'カテゴリ': 'コラボ',
      _collabTags: ['倉持めると'],
      _roles: ['VOCAL'],
      _types: ['Full'],
      _time: 100,
      _searchText: 'vocal match full'
    })
  ];

  context.FilterState.setState({
    searchQuery: 'VOCAL OR DANCE -Shorts',
    sortOrder: 'desc',
    include: {
      category: 'コラボ',
      platform: 'youtube',
      format: ['歌枠'],
      role: ['VOCAL', 'DANCE'],
      collab: ['倉持めると', '石神のぞみ']
    },
    exclude: {
      collab: ['ソフィア・ヴァレンタイン']
    }
  });

  assert.deepEqual(
    toPlain(runFilterPipeline(context, videos)).map(video => video.id),
    ['vocal-match', 'dance-match']
  );
});

test('Collabの三状態変更を次の絞り込み結果へ反映する', () => {
  const { context } = createFilterPipelineFixture();
  const videos = [
    createVideo('both', { _collabTags: ['倉持めると', '石神のぞみ'], _time: 300 }),
    createVideo('kuramochi', { _collabTags: ['倉持めると'], _time: 200 }),
    createVideo('ishigami', { _collabTags: ['石神のぞみ'], _time: 100 })
  ];

  context.FilterState.toggleTag('collab', '倉持めると');
  context.FilterState.toggleTag('collab', '石神のぞみ');
  assert.deepEqual(
    toPlain(runFilterPipeline(context, videos)).map(video => video.id),
    ['both', 'kuramochi', 'ishigami']
  );

  context.FilterState.toggleTag('collab', '倉持めると');
  assert.deepEqual(
    toPlain(runFilterPipeline(context, videos)).map(video => video.id),
    ['ishigami']
  );

  context.FilterState.toggleTag('collab', '倉持めると');
  assert.deepEqual(
    toPlain(runFilterPipeline(context, videos)).map(video => video.id),
    ['both', 'ishigami']
  );
});
