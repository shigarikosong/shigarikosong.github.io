import assert from 'node:assert/strict';
import test from 'node:test';

import { loadBrowserScript, toPlain } from './browser-script-test-utils.mjs';

function createFilterTagView(initialState = 'none') {
  let state = initialState;
  const context = loadBrowserScript('filter-tag-view.js', {
    FilterState: {
      getDisplayLabel: (_group, value) => value,
      isTagExcluded: () => state === 'exclude',
      isTagIncluded: () => state === 'include',
      normalizeValue: (group, value) => group === 'platform'
        ? String(value).toLowerCase()
        : String(value)
    }
  });

  return {
    filterTagView: context.FilterTagView,
    setState(nextState) {
      state = nextState;
    }
  };
}

function createButton(initialClasses = []) {
  const classes = new Set(initialClasses);
  const attributes = new Map();

  return {
    attributes,
    classList: {
      add: value => classes.add(value),
      contains: value => classes.has(value),
      toggle(value, force) {
        if (force) classes.add(value);
        else classes.delete(value);
      }
    },
    dataset: {},
    removeAttribute(name) {
      attributes.delete(name);
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    textContent: ''
  };
}

test('タグ状態から描画用の表示を決定する', () => {
  const { filterTagView, setState } = createFilterTagView();

  assert.deepEqual(toPlain(filterTagView.getPresentation('platform', 'YouTube', 'YouTube')), {
    group: 'platform',
    value: 'youtube',
    label: 'YouTube',
    state: 'none',
    text: 'YouTube',
    ariaLabel: ''
  });

  setState('include');
  assert.equal(filterTagView.getPresentation('format', 'Shorts').state, 'include');

  setState('exclude');
  assert.deepEqual(toPlain(filterTagView.getPresentation('time', 'recent', '最近')), {
    group: 'date',
    value: 'recent',
    label: '最近',
    state: 'exclude',
    text: '- 最近',
    ariaLabel: '最近を除外中'
  });
});

test('各タグ種別のincludeクラスを描画時に反映する', () => {
  const { filterTagView } = createFilterTagView('include');
  const classPairs = [
    ['tag-style', 'tag-style-active'],
    ['tag-platform', 'tag-platform-active'],
    ['tag-time', 'tag-time-active'],
    ['tag-format', 'tag-format-active'],
    ['tag-role-filter', 'tag-role-filter-active'],
    ['tag-collab-liver', 'tag-collab-liver-active'],
    ['tag-collab-unit', 'tag-collab-unit-active']
  ];

  classPairs.forEach(([baseClass, activeClass]) => {
    const button = createButton([baseClass]);
    filterTagView.applyButton(
      button,
      filterTagView.getPresentation('format', 'Shorts')
    );
    assert.equal(button.classList.contains(activeClass), true, baseClass);
  });
});

test('includeとexclude表示をボタンへ反映し、解除時に後付け属性を残さない', () => {
  const { filterTagView, setState } = createFilterTagView('include');
  const button = createButton(['tag-format']);

  filterTagView.applyButton(
    button,
    filterTagView.getPresentation('format', 'Shorts')
  );

  assert.equal(button.classList.contains('tag-format-active'), true);
  assert.equal(button.classList.contains('exclusion-style-active'), false);

  setState('exclude');

  filterTagView.applyButton(
    button,
    filterTagView.getPresentation('format', 'Shorts')
  );

  assert.equal(button.textContent, '- Shorts');
  assert.equal(button.classList.contains('tag-format-active'), false);
  assert.equal(button.classList.contains('exclusion-style-active'), true);
  assert.equal(button.attributes.get('aria-label'), 'Shortsを除外中');
  assert.deepEqual(button.dataset, {
    filterGroup: 'format',
    filterValue: 'Shorts',
    filterTagViewAria: 'true'
  });

  setState('none');
  filterTagView.applyButton(
    button,
    filterTagView.getPresentation('format', 'Shorts')
  );

  assert.equal(button.textContent, 'Shorts');
  assert.equal(button.classList.contains('exclusion-style-active'), false);
  assert.equal(button.attributes.has('aria-label'), false);
  assert.equal('filterTagViewAria' in button.dataset, false);
});
