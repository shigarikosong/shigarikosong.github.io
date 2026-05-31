(() => {
  function getVisibleElementHeight(element) {
    if (!element || element.classList.contains('hidden')) return 0;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return 0;

    const rect = element.getBoundingClientRect();
    return rect.height > 0 ? rect.height : 0;
  }

  function getStickyTopOffset(options = {}) {
    const { extra = 12 } = options;
    const filterSection = document.getElementById('filterSection');
    const activeTagChips = document.getElementById('activeTagChips');

    return getVisibleElementHeight(filterSection) + getVisibleElementHeight(activeTagChips) + extra;
  }

  function getPlayerBottomOffset(options = {}) {
    const { actionsGap = 32 } = options;
    const fixedPlayer = document.getElementById('fixedPlayer');
    const nowPlayingWrapper = document.getElementById('nowPlayingWrapper');
    const windowActions = document.querySelector('.player-window-actions');
    const fixedPlayerVisible = fixedPlayer && window.getComputedStyle(fixedPlayer).display !== 'none';

    if (!fixedPlayerVisible) return 0;

    const playerActionsHeight = getVisibleElementHeight(windowActions)
      ? getVisibleElementHeight(windowActions) + actionsGap
      : 0;

    return getVisibleElementHeight(fixedPlayer) + getVisibleElementHeight(nowPlayingWrapper) + playerActionsHeight;
  }

  function getBottomReservedHeight(options = {}) {
    const { extra = 16 } = options;
    return getPlayerBottomOffset(options) + extra;
  }

  function scrollElementIntoComfortView(element, options = {}) {
    if (!element) return;

    const {
      behavior = 'smooth',
      topOffset = getStickyTopOffset(),
      marginTop = 0
    } = options;
    const rect = element.getBoundingClientRect();
    const pageTop = window.scrollY + rect.top;
    const targetY = pageTop - topOffset - marginTop;

    window.scrollTo({
      top: Math.max(0, Math.round(targetY)),
      behavior
    });
  }

  function isElementComfortablyVisible(element, options = {}) {
    if (!element) return false;

    const {
      topOffset = getStickyTopOffset(),
      bottomReserved = getBottomReservedHeight()
    } = options;
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height || window.innerHeight;

    return rect.bottom > topOffset && rect.top < viewportHeight - bottomReserved;
  }

  function getVisibleResultCountElement() {
    return [
      document.getElementById('songCount'),
      document.getElementById('desktopResultCount')
    ].find(element => getVisibleElementHeight(element) > 0);
  }

  function scrollToResultCountOrListTop(options = {}) {
    const countElement = getVisibleResultCountElement();
    const videoList = document.getElementById('videoList');
    scrollElementIntoComfortView(countElement || videoList, options);
  }

  window.ScrollUtils = Object.freeze({
    getVisibleElementHeight,
    getStickyTopOffset,
    getPlayerBottomOffset,
    getBottomReservedHeight,
    getVisibleResultCountElement,
    scrollElementIntoComfortView,
    isElementComfortablyVisible,
    scrollToResultCountOrListTop
  });
})();
