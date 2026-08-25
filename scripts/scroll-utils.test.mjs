import assert from 'node:assert/strict';
import test from 'node:test';

import { loadBrowserScript, toPlain } from './browser-script-test-utils.mjs';

function createClassList(initialClasses = []) {
  const classes = new Set(initialClasses);
  return {
    add(value) {
      classes.add(value);
    },
    contains(value) {
      return classes.has(value);
    },
    remove(value) {
      classes.delete(value);
    },
    toggle(value, force) {
      if (force === true) classes.add(value);
      else if (force === false) classes.delete(value);
      else if (classes.has(value)) classes.delete(value);
      else classes.add(value);
      return classes.has(value);
    }
  };
}

function createElement(options = {}) {
  const {
    top = 0,
    height = 0,
    display = 'block',
    visibility = 'visible',
    classes = [],
    insidePlayerStageDock = false
  } = options;

  return {
    classList: createClassList(classes),
    computedStyle: { display, visibility },
    closest(selector) {
      return selector === '#playerStageDock' && insidePlayerStageDock ? {} : null;
    },
    getBoundingClientRect() {
      return { top, bottom: top + height, height };
    }
  };
}

function createScrollFixture(options = {}) {
  const elements = options.elements || {};
  const queryResults = options.queryResults || {};
  const scrollCalls = [];
  const document = {
    body: { scrollTop: 0 },
    documentElement: { scrollTop: 0 },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector(selector) {
      return queryResults[selector] || null;
    }
  };
  const context = loadBrowserScript('scroll-utils.js', {
    document,
    innerHeight: options.innerHeight || 800,
    visualViewport: options.visualViewport || null,
    scrollY: options.scrollY || 0,
    getComputedStyle(element) {
      return element?.computedStyle || { display: 'block', visibility: 'visible' };
    },
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    scrollTo(...args) {
      scrollCalls.push(args);
    },
    setTimeout(callback) {
      callback();
      return 1;
    }
  });

  return { context, document, scrollCalls, scrollUtils: context.ScrollUtils };
}

test('stickyフィルターと表示中プレイヤーの予約領域を計算する', () => {
  const fixedPlayer = createElement({ height: 200 });
  const nowPlayingWrapper = createElement({ height: 50 });
  const windowActions = createElement({ height: 40, insidePlayerStageDock: true });
  const { scrollUtils } = createScrollFixture({
    elements: {
      filterSection: createElement({ height: 60 }),
      activeTagChips: createElement({ height: 30 }),
      fixedPlayer,
      nowPlayingWrapper
    },
    queryResults: { '.player-window-actions': windowActions }
  });

  assert.equal(scrollUtils.getStickyTopOffset(), 102);
  assert.equal(scrollUtils.getPlayerBottomOffset(), 250);

  fixedPlayer.classList.add('is-collapsed');
  assert.equal(scrollUtils.getPlayerBottomOffset(), 322);
  assert.equal(scrollUtils.getBottomReservedHeight(), 338);
});

test('要素をsticky領域の下へ即時スクロールする', () => {
  const target = createElement({ top: 250, height: 80 });
  const { document, scrollCalls, scrollUtils } = createScrollFixture({ scrollY: 300 });

  scrollUtils.scrollElementIntoComfortView(target, {
    behavior: 'auto',
    topOffset: 100,
    marginTop: 10
  });

  assert.deepEqual(scrollCalls, [[0, 440]]);
  assert.equal(document.documentElement.scrollTop, 440);
  assert.equal(document.body.scrollTop, 440);
});

test('再生中カード用APIは通常の快適位置スクロールと同じ位置を使う', () => {
  const target = createElement({ top: 300, height: 80 });
  const { scrollCalls, scrollUtils } = createScrollFixture();

  scrollUtils.scrollPlayingCardIntoComfortView(target, {
    behavior: 'smooth',
    topOffset: 75
  });

  assert.deepEqual(toPlain(scrollCalls), [[{ top: 225, behavior: 'smooth' }]]);
});

test('上下の予約領域を考慮して要素の表示状態を判定する', () => {
  const { scrollUtils } = createScrollFixture({
    innerHeight: 800,
    visualViewport: { height: 700 }
  });

  assert.equal(scrollUtils.isElementComfortablyVisible(
    createElement({ top: 150, height: 100 }),
    { topOffset: 100, bottomReserved: 200 }
  ), true);
  assert.equal(scrollUtils.isElementComfortablyVisible(
    createElement({ top: 520, height: 80 }),
    { topOffset: 100, bottomReserved: 200 }
  ), false);
  assert.equal(scrollUtils.isElementComfortablyVisible(
    createElement({ top: 20, height: 60 }),
    { topOffset: 100, bottomReserved: 200 }
  ), false);
});

test('フィルターを閉じる際は再生中カードを優先し、なければ件数表示へ移動する', () => {
  const playingItem = createElement({ top: 320, height: 80 });
  const countElement = createElement({ top: 120, height: 30 });
  const queryResults = { '#videoList .playing': playingItem };
  const { scrollCalls, scrollUtils } = createScrollFixture({
    elements: { songCount: countElement },
    queryResults
  });

  scrollUtils.scrollToPlayingOrResultCountOrListTop({ behavior: 'auto', topOffset: 80 });
  assert.deepEqual(scrollCalls.at(-1), [0, 240]);

  queryResults['#videoList .playing'] = null;
  scrollUtils.scrollToPlayingOrResultCountOrListTop({ behavior: 'auto', topOffset: 80 });
  assert.deepEqual(scrollCalls.at(-1), [0, 40]);
});

test('フィルターを閉じた後の再補正でも対象を維持し、再生中がなければ一覧上部へ確定する', () => {
  const playingItem = createElement({ top: 320, height: 80 });
  const playingFixture = createScrollFixture({
    queryResults: { '#videoList .playing': playingItem }
  });

  playingFixture.scrollUtils.requestFilterCloseTargetJump({ topOffset: 80 });
  assert.equal(playingFixture.scrollCalls.length >= 4, true);
  assert.equal(
    playingFixture.scrollCalls.every(call => call[0] === 0 && call[1] === 240),
    true
  );

  const listFixture = createScrollFixture({
    elements: {
      songCount: createElement({ top: 120, height: 30 }),
      videoList: createElement({ top: 200, height: 500 })
    },
    queryResults: { '#videoList .playing': null }
  });

  listFixture.scrollUtils.requestFilterCloseTargetJump({ topOffset: 80 });
  assert.deepEqual(listFixture.scrollCalls[0], [0, 40]);
  assert.deepEqual(listFixture.scrollCalls.at(-1), [0, 120]);
});
