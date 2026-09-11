import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppFixture, videoRow } from './app-test-fixture.mjs';

const rows = [
  videoRow('aaaaaaaaaaa', {
    title: 'Song A', 'カテゴリ': 'ソロ', '担当区分': 'VOCAL',
    '動画種別': 'Live', '3D': 'TRUE', '公開月': '2020/01',
    'コラボライバー': 'Member "A"', 'コラボユニット': 'Unit'
  }),
  videoRow('bbbbbbbbbbb', { title: 'Song B', 'カテゴリ': 'コラボ', '担当区分': 'DANCE', '公開月': '2021/01', 'コラボライバー': 'Member B' })
];

function activate(document, selector) {
  const button = document.querySelector(selector);
  assert.ok(button, selector);
  button.focus();
  button.click();
}

function key(window, element, key, options = {}) {
  const event = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  element.dispatchEvent(event);
  return event;
}

for (const mode of ['desktop', 'modal']) {
  test(`${mode} tags keep focus through include, exclude, clear and external rerenders`, async t => {
    const app = await createAppFixture(t, rows, { mobile: mode === 'modal' });
    const { window, document } = app;
    activate(document, mode === 'desktop' ? '#desktopToggleFilters' : '#openFilterModal');
    const containers = ['Category', 'Platform', 'Date', 'Format', 'Role', 'CollabLiver', 'CollabUnit'];
    for (const name of containers) {
      const container = document.getElementById(`${mode}${name}Tags`);
      let button = container.querySelector('button');
      assert.ok(button, name);
      const { filterGroup, filterValue, focusKey } = button.dataset;
      button.focus();
      for (const state of ['include', 'exclude', 'none']) {
        document.activeElement.click();
        await app.flushFrames();
        button = document.activeElement;
        assert.equal(button.dataset.focusKey, focusKey, `${name}: ${state}`);
        assert.equal(container.contains(button), true);
        assert.equal(window.FilterState.isTagIncluded(filterGroup, filterValue), state === 'include');
        assert.equal(window.FilterState.isTagExcluded(filterGroup, filterValue), state === 'exclude');
        assert.equal(button.getAttribute('aria-label'), state === 'none' ? null
          : state === 'include' ? `${window.FilterState.getDisplayLabel(filterGroup, filterValue)}を選択中`
            : `${window.FilterState.getDisplayLabel(filterGroup, filterValue)}を除外中`);
      }
      window.dispatchEvent(new window.Event('collabTagOrderReady'));
      assert.equal(document.activeElement.dataset.focusKey, focusKey);
    }
  });

  test(`${mode} sort buttons expose one selected option and retain focus`, async t => {
    const { document } = await createAppFixture(t, rows, { mobile: mode === 'modal' });
    activate(document, mode === 'desktop' ? '#desktopToggleFilters' : '#openFilterModal');
    const group = mode === 'desktop' ? '#desktopSortButtons' : '#filterModal [role="group"]';
    activate(document, `${group} [data-sort="asc"]`);
    assert.equal(document.activeElement.dataset.sort, 'asc');
    assert.equal(document.querySelectorAll(`${group} [aria-pressed="true"]`).length, 1);
    assert.equal(document.activeElement.getAttribute('aria-pressed'), 'true');
    activate(document, `${group} [data-sort="title"]`);
    assert.equal(document.activeElement.dataset.sort, 'title');
    assert.equal(document.querySelector(`${group} [data-sort="asc"]`).getAttribute('aria-pressed'), 'false');
  });
}

test('list actions restore within the same video, and disappearing cards focus the list', async t => {
  const { document, window } = await createAppFixture(t, rows);
  const source = '#videoList [data-video-key="aaaaaaaaaaa__0"]';
  activate(document, `${source} .video-title`);
  assert.equal(document.activeElement.classList.contains('video-title'), true);
  assert.equal(document.activeElement.closest('[data-video-key]').dataset.videoKey, 'aaaaaaaaaaa__0');
  window.clearSearchQuery({ scrollAfterUpdate: false });
  activate(document, `${source} [data-filter-group="platform"]`);
  assert.equal(document.activeElement.closest('[data-video-key]').dataset.videoKey, 'aaaaaaaaaaa__0');
  document.activeElement.click();
  assert.equal(document.querySelectorAll('#videoList [data-video-key]').length, 0);
  assert.equal(document.activeElement.id, 'videoList');
});

test('removing chips focuses a remaining chip, then the results when none remain', async t => {
  const { document, window } = await createAppFixture(t, rows);
  window.FilterState.setState({ include: { platform: 'youtube', role: ['VOCAL'] } });
  window.applyFilters({ scrollAfterUpdate: false });
  activate(document, '#activeTagChipsInner button');
  assert.equal(document.getElementById('activeTagChipsInner').contains(document.activeElement), true);
  document.activeElement.click();
  assert.equal(document.activeElement.id, 'videoList');
});

for (const config of [
  { open: '#openFilterModal', modal: '#filterModal', first: '[data-sort="desc"]', last: '#applyFilters' },
  { open: '#openSiteInfoModal', modal: '#siteInfoModal', first: '#closeSiteInfoModal', last: '#closeSiteInfoModalBottom' }
]) {
  test(`${config.modal} focuses inside, cycles Tab, closes via cancel and restores the opener`, async t => {
    const { document, window } = await createAppFixture(t, rows, { mobile: config.modal === '#filterModal' });
    activate(document, config.open);
    const modal = document.querySelector(config.modal);
    assert.equal(modal.tagName, 'DIALOG');
    assert.equal(modal.open, true);
    assert.equal(modal.contains(document.activeElement), true);
    const first = modal.querySelector(config.first);
    const last = modal.querySelector(config.last);
    last.focus();
    assert.equal(key(window, last, 'Tab').defaultPrevented, true);
    assert.equal(document.activeElement, first);
    key(window, first, 'Tab', { shiftKey: true });
    assert.equal(document.activeElement, last);
    // Browsers dispatch cancel for Escape; jsdom does not perform that default action.
    modal.dispatchEvent(new window.Event('cancel', { cancelable: true }));
    assert.equal(modal.open, false);
    assert.equal(document.activeElement, document.querySelector(config.open));
    assert.equal(document.body.style.overflow, '');
    assert.equal(document.body.style.position, '');
  });
}

test('mobile Escape applies pending sort once and closing after immediate changes adds no render', async t => {
  const app = await createAppFixture(t, rows, { mobile: true });
  const { document, window } = app;
  let renders = 0;
  window.addEventListener('videoListRendered', () => renders++);
  activate(document, '#openFilterModal');
  activate(document, '#filterModal [data-sort="asc"]');
  assert.equal(renders, 0);
  document.getElementById('filterModal').dispatchEvent(new window.Event('cancel', { cancelable: true }));
  await app.flushFrames();
  assert.equal(renders, 1);
  assert.deepEqual(app.visibleKeys(), ['aaaaaaaaaaa__0', 'bbbbbbbbbbb__0']);
  activate(document, '#openFilterModal');
  activate(document, '#modalRoleTags [data-filter-value="VOCAL"]');
  assert.equal(renders, 2);
  activate(document, '#applyFilters');
  await app.flushFrames();
  assert.equal(renders, 2);
});

test('modal switch releases the mobile scroll lock and preserves pending filters', async t => {
  const app = await createAppFixture(t, rows, { mobile: true });
  const { document } = app;
  activate(document, '#openFilterModal');
  activate(document, '#filterModal [data-sort="asc"]');
  document.getElementById('openSiteInfoModal').click();
  await app.flushFrames();
  assert.equal(document.getElementById('filterModal').open, false);
  assert.equal(document.getElementById('siteInfoModal').open, true);
  assert.equal(document.body.style.position, '');
  assert.equal(document.body.style.overflow, 'hidden');
  activate(document, '#closeSiteInfoModalBottom');
  assert.equal(document.body.style.overflow, '');
  assert.deepEqual(app.visibleKeys(), ['aaaaaaaaaaa__0', 'bbbbbbbbbbb__0']);
});

test('player shortcuts do not act on the background while either dialog is open', async t => {
  const app = await createAppFixture(t, rows, { mobile: true });
  const { document, window } = app;
  app.youtube.ready();
  app.play('aaaaaaaaaaa__0');
  for (const opener of ['#openFilterModal', '#openSiteInfoModal']) {
    activate(document, opener);
    key(window, document.activeElement, 'D', { shiftKey: true });
    key(window, document.activeElement, 'A', { shiftKey: true });
    assert.equal(window.nowPlayingKey, 'aaaaaaaaaaa__0');
    document.querySelector('dialog[open]').dispatchEvent(new window.Event('cancel', { cancelable: true }));
  }
});

test('desktop Escape closes the panel and restores its toggle', async t => {
  const { document, window } = await createAppFixture(t, rows);
  activate(document, '#desktopToggleFilters');
  const button = document.querySelector('#desktopPlatformTags button');
  button.focus();
  key(window, button, 'Escape');
  assert.equal(document.getElementById('desktopFilterPanel').classList.contains('hidden'), true);
  assert.equal(document.activeElement.id, 'desktopToggleFilters');
});

test('native close events use the same mobile cleanup and apply path', async t => {
  const app = await createAppFixture(t, rows, { mobile: true });
  const { document } = app;
  activate(document, '#openFilterModal');
  activate(document, '#filterModal [data-sort="asc"]');
  document.getElementById('filterModal').close();
  await app.flushFrames();
  assert.equal(document.getElementById('filterModal').classList.contains('hidden'), true);
  assert.equal(document.body.style.position, '');
  assert.equal(document.activeElement.id, 'openFilterModal');
  assert.deepEqual(app.visibleKeys(), ['aaaaaaaaaaa__0', 'bbbbbbbbbbb__0']);
});

test('reopening before a pending close apply does not jump the background list', async t => {
  const app = await createAppFixture(t, rows, { mobile: true });
  const { document, window } = app;
  let closeJumps = 0;
  window.ScrollUtils = { ...window.ScrollUtils, requestFilterCloseTargetJump: () => closeJumps++ };
  activate(document, '#openFilterModal');
  activate(document, '#filterModal [data-sort="asc"]');
  activate(document, '#applyFilters');
  activate(document, '#openFilterModal');
  await app.flushFrames();
  assert.equal(closeJumps, 0);
  assert.equal(document.getElementById('filterModal').contains(document.activeElement), true);
  assert.equal(document.body.dataset.filterScrollLocked, 'true');
});

test('focus restoration does not steal focus from another control or an unchanged search input', async t => {
  const { document, window } = await createAppFixture(t, rows);
  const search = document.getElementById('searchInput');
  search.focus();
  search.value = 'Song';
  search.setSelectionRange(2, 2);
  window.applyFilters({ scrollAfterUpdate: false });
  assert.equal(document.activeElement, search);
  assert.equal(search.selectionStart, 2);

  const list = document.getElementById('videoList');
  list.querySelector('button').focus();
  const restore = window.FocusUtils.capture(list, list);
  list.querySelector('button').remove();
  search.focus();
  restore();
  assert.equal(document.activeElement, search);
});

test('late Collab ordering preserves focus when existing nodes are moved', async t => {
  const app = await createAppFixture(t, rows, {
    includeUiPolish: true,
    collabTags: [{ tag_name: 'Member B', sort_order: 1 }, { tag_name: 'Member "A"', sort_order: 2 }]
  });
  const { document, window } = app;
  activate(document, '#desktopToggleFilters');
  const container = document.getElementById('desktopCollabLiverTags');
  const [first, second] = [...container.children];
  second.focus();
  container.appendChild(first);
  assert.equal(document.activeElement, second);
  window.sortRenderedCollabTagContainers();
  assert.equal(container.firstElementChild, first);
  assert.equal(document.activeElement, second);
  await app.flushFrames();
  assert.equal(document.activeElement.dataset.focusKey, second.dataset.focusKey);
  assert.equal(container.contains(document.activeElement), true);
});
