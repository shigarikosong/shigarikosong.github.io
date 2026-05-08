(() => {
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  function isPlayingCard(element) {
    return element instanceof Element &&
      element.classList.contains('playing') &&
      Boolean(element.closest('#videoList'));
  }

  function getVisibleFixedHeight(element) {
    if (!element || element.classList.contains('hidden')) return 0;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return 0;

    const rect = element.getBoundingClientRect();
    return rect.height > 0 ? rect.height : 0;
  }

  function getBottomReservedHeight() {
    const fixedPlayer = document.getElementById('fixedPlayer');
    const nowPlaying = document.getElementById('nowPlayingWrapper');

    return getVisibleFixedHeight(fixedPlayer) + getVisibleFixedHeight(nowPlaying) + 16;
  }

  function scrollPlayingCardIntoView(element, options) {
    const rect = element.getBoundingClientRect();
    const pageTop = window.scrollY + rect.top;
    const bottomReserved = getBottomReservedHeight();
    const topReserved = window.innerWidth < 640 ? 56 : 72;
    const usableHeight = Math.max(240, window.innerHeight - bottomReserved - topReserved);

    let targetY;

    if (rect.height >= usableHeight) {
      targetY = pageTop - topReserved;
    } else {
      const visualOffset = usableHeight * 0.28;
      targetY = pageTop - topReserved - visualOffset;
    }

    window.scrollTo({
      top: Math.max(0, Math.round(targetY)),
      behavior: options?.behavior || 'smooth'
    });
  }

  Element.prototype.scrollIntoView = function patchedScrollIntoView(options) {
    if (isPlayingCard(this)) {
      scrollPlayingCardIntoView(this, options);
      return;
    }

    return originalScrollIntoView.call(this, options);
  };
})();
