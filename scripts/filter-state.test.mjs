import assert from 'node:assert/strict';
import test from 'node:test';

import { loadBrowserScript, toPlain } from './browser-script-test-utils.mjs';

function createFilterStateFixture(options = {}) {
  const elements = {
    searchInput: { value: options.searchQuery || '' },
    modalSearchInput: { value: options.searchQuery || '' },
    sortOrder: { value: options.sortOrder || 'desc' },
    modalSortOrder: { value: options.sortOrder || 'desc' }
  };
  const context = loadBrowserScript('filter-state.js', {
    document: {
      getElementById(id) {
        return elements[id] || null;
      }
    },
    TAG_CONFIG: {
      dateLabelToValue: {
        '最近': 'recent',
        '1年以内': 'year',
        '1年以上前': 'old'
      },
      getPlatformLabel(value) {
        return value === 'youtube' ? 'YouTube' : value === 'tiktok' ? 'TikTok' : value;
      }
    },
    DATE_UTILS: {
      getDateTagLabel(value) {
        return value === 'recent' ? '最近' : value;
      },
      parseYmdToTime() {
        return Number.NaN;
      }
    }
  });

  return { context, filterState: context.FilterState, elements };
}

test('タグは未選択からinclude、exclude、未選択へ循環する', () => {
  const { filterState } = createFilterStateFixture();

  assert.equal(filterState.toggleTag('category', 'ソロ'), 'include');
  assert.equal(filterState.isTagIncluded('category', 'ソロ'), true);
  assert.equal(filterState.isTagExcluded('category', 'ソロ'), false);

  assert.equal(filterState.toggleTag('category', 'ソロ'), 'exclude');
  assert.equal(filterState.isTagIncluded('category', 'ソロ'), false);
  assert.equal(filterState.isTagExcluded('category', 'ソロ'), true);

  assert.equal(filterState.toggleTag('category', 'ソロ'), 'none');
  assert.equal(filterState.isTagIncluded('category', 'ソロ'), false);
  assert.equal(filterState.isTagExcluded('category', 'ソロ'), false);
});

test('Riko PartとCollabは複数のinclude状態を独立して保持する', () => {
  const { filterState } = createFilterStateFixture();

  filterState.setState({
    include: {
      role: ['VOCAL', 'DANCE'],
      collab: ['倉持めると', '石神のぞみ']
    }
  });

  const state = toPlain(filterState.getState());
  assert.deepEqual(state.include.role, ['VOCAL', 'DANCE']);
  assert.deepEqual(state.include.collab, ['倉持めると', '石神のぞみ']);

  filterState.toggleTag('role', 'VOCAL');
  assert.equal(filterState.isTagExcluded('role', 'VOCAL'), true);
  assert.equal(filterState.isTagIncluded('role', 'DANCE'), true);
  assert.equal(filterState.isTagIncluded('collab', '倉持めると'), true);
  assert.equal(filterState.isTagIncluded('collab', '石神のぞみ'), true);
});

test('Platform、Time、3DとShortsを既存の内部値へ正規化する', () => {
  const { filterState } = createFilterStateFixture();

  filterState.setTagState('platform', 'YouTube', 'include');
  filterState.setTagState('time', '最近', 'include');
  filterState.setTagState('format', '3D', 'include');
  filterState.setTagState('format', 'Shorts', 'include');

  const state = toPlain(filterState.getState());
  assert.equal(state.include.platform, 'youtube');
  assert.equal(state.include.date, 'recent');
  assert.deepEqual(state.include.flag, ['3D', 'Shorts']);
  assert.equal(filterState.isTagIncluded('format', '3D'), true);
});

test('除外条件は該当する動画だけを一覧対象から外す', () => {
  const { filterState } = createFilterStateFixture();
  const videos = [
    { id: 'role', _roles: ['VOCAL'], _types: [], _collabTags: [], _platform: 'youtube' },
    { id: 'collab', _roles: ['DANCE'], _types: [], _collabTags: ['倉持めると'], _platform: 'youtube' },
    { id: 'keep', _roles: ['DANCE'], _types: ['Full'], _collabTags: [], _platform: 'youtube' }
  ];

  filterState.setTagState('role', 'VOCAL', 'exclude');
  filterState.setTagState('collab', '倉持めると', 'exclude');

  assert.deepEqual(
    toPlain(filterState.filterExcludedVideos(videos)).map(video => video.id),
    ['keep']
  );
});

test('リセットはタグ条件を消し、指定に応じて検索語と並び順を維持する', () => {
  const { filterState, elements } = createFilterStateFixture({
    searchQuery: 'VOCAL 3D',
    sortOrder: 'title'
  });

  filterState.setTagState('format', '歌枠', 'include');
  filterState.setTagState('role', 'VOCAL', 'exclude');
  filterState.resetState({ resetSearch: false, resetSort: false });

  let state = toPlain(filterState.getState());
  assert.equal(state.searchQuery, 'VOCAL 3D');
  assert.equal(state.sortOrder, 'title');
  assert.deepEqual(state.include.format, []);
  assert.deepEqual(state.exclude.role, []);

  filterState.resetState();
  state = toPlain(filterState.getState());
  assert.equal(state.searchQuery, '');
  assert.equal(state.sortOrder, 'desc');
  assert.equal(elements.modalSearchInput.value, '');
  assert.equal(elements.modalSortOrder.value, 'desc');
});

test('include状態や移行済みの互換APIを古いグローバルへ公開しない', () => {
  const { context, filterState } = createFilterStateFixture();
  const legacyNames = [
    'selectedCategoryTag',
    'selectedPlatformTag',
    'selectedDateTag',
    'selectedVideoTypeTags',
    'selectedRoleTags',
    'selectedCollabTags',
    'selectedRoleTag',
    'selectedCollabTag',
    'selected3DTag',
    'selectedShortsTag'
  ];

  filterState.setState({
    include: {
      category: 'コラボ',
      platform: 'youtube',
      date: 'recent',
      format: ['歌枠'],
      role: ['VOCAL'],
      collab: ['倉持めると'],
      flag: ['3D']
    }
  });

  assert.ok(legacyNames.every(name => !Object.prototype.hasOwnProperty.call(context, name)));
  assert.equal(filterState.registerExclusionAdapter, undefined);
  assert.deepEqual(toPlain(filterState.getState().include), {
    category: 'コラボ',
    platform: 'youtube',
    date: 'recent',
    format: ['歌枠'],
    role: ['VOCAL'],
    collab: ['倉持めると'],
    flag: ['3D']
  });
});
