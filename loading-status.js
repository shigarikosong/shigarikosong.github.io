(() => {
  const videoList = document.getElementById('videoList');
  if (!videoList || !window.fetch) return;

  const errorMessage = 'データの読み込みに失敗しました。\n時間をおいて再読み込みしてください。';

  const style = document.createElement('style');
  style.textContent = `
    .loading-status {
      margin: 20px 0;
      padding: 18px 20px;
      border: 1px solid #bfdbfe;
      border-radius: 14px;
      background: #eff6ff;
      color: #1e40af;
      font-size: 14px;
      font-weight: 700;
      text-align: center;
      white-space: pre-line;
    }

    .loading-status.is-error {
      border-color: #fecaca;
      background: #fef2f2;
      color: #b91c1c;
    }

    .back-to-top-button {
      position: fixed;
      right: 16px;
      bottom: 24px;
      z-index: 34;
      width: 38px;
      height: 38px;
      border: 1px solid rgba(30, 64, 175, 0.14);
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.78);
      color: #1e40af;
      box-shadow: 0 5px 16px rgba(15, 23, 42, 0.14);
      font-size: 18px;
      font-weight: 700;
      line-height: 1;
      opacity: 0;
      pointer-events: none;
      transform: translateY(10px);
      transition: opacity 0.2s ease, transform 0.2s ease, bottom 0.2s ease, right 0.2s ease, background-color 0.2s ease;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .back-to-top-button.is-visible {
      opacity: 0.86;
      pointer-events: auto;
      transform: translateY(0);
    }

    .back-to-top-button:hover {
      opacity: 1;
      background: #ffffff;
    }

    .back-to-top-button:active {
      transform: translateY(0) scale(0.96);
    }

    .back-to-top-button.is-player-visible {
      bottom: calc(var(--back-to-top-player-offset, 120px) + 10px);
    }

    .back-to-top-button.has-now-playing-companion {
      bottom: 68px;
    }

    .back-to-top-button.is-player-visible.has-now-playing-companion {
      bottom: calc(var(--back-to-top-player-offset, 120px) + 64px);
    }

    .back-to-top-button.now-playing-floating-button {
      bottom: 24px;
    }

    .back-to-top-button.now-playing-floating-button.is-player-visible {
      bottom: calc(var(--back-to-top-player-offset, 120px) + 10px);
    }

    @media (max-width: 639px) {
      .back-to-top-button {
        right: 12px;
        width: 34px;
        height: 34px;
        font-size: 16px;
      }

      .back-to-top-button.is-player-visible {
        right: 12px;
      }
    }
  `;
  document.head.appendChild(style);

  let status = null;

  function setStatus(message, isError = false, force = false) {
    if (!status || !videoList.contains(status)) {
      if (!force) return;

      status = document.createElement('div');
      status.id = 'loadingStatus';
      status.className = 'loading-status';
      videoList.innerHTML = '';
      videoList.appendChild(status);
    }

    status.textContent = message;
    status.classList.toggle('is-error', isError);
    status.setAttribute('role', isError ? 'alert' : 'status');
    status.setAttribute('aria-live', 'polite');
  }

  function showVideoListLoading() {
    setStatus('動画リストを読み込んでいます...', false, true);
  }

  function showVideoListPreparing(count) {
    setStatus(`${count}件の動画を準備しています...`, false, true);
  }

  function showVideoListRendering() {
    setStatus('リストを表示しています...');
  }

  function showVideoListError() {
    setStatus(errorMessage, true, true);
  }

  function setupBackToTopButton() {
    const SHOW_SCROLL_Y = 420;
    const TOP_HIDE_SCROLL_Y = 24;
    const HIDE_DELAY_MS = 1100;
    const button = document.createElement('button');
    let updateFrame = null;
    let hideTimer = null;
    let isScrolling = false;
    let isPointerOver = false;

    button.type = 'button';
    button.id = 'backToTopButton';
    button.className = 'back-to-top-button';
    button.setAttribute('aria-label', 'ページトップへ戻る');
    button.textContent = '↑';

    document.body.appendChild(button);

    function getPlayerOffset() {
      if (window.ScrollUtils?.getPlayerBottomOffset) {
        return Math.ceil(window.ScrollUtils.getPlayerBottomOffset());
      }

      const fixedPlayer = document.getElementById('fixedPlayer');
      const nowPlayingWrapper = document.getElementById('nowPlayingWrapper');
      const windowActions = document.querySelector('.player-window-actions');
      const fixedPlayerVisible = fixedPlayer && getComputedStyle(fixedPlayer).display !== 'none';

      if (!fixedPlayerVisible) return 0;

      const playerHeight = fixedPlayer.getBoundingClientRect().height || 0;
      const nowPlayingHeight = nowPlayingWrapper && !nowPlayingWrapper.classList.contains('hidden')
        ? nowPlayingWrapper.getBoundingClientRect().height || 0
        : 0;
      const playerActionsHeight = windowActions
        && (
          !windowActions.closest('#playerStageDock') ||
          fixedPlayer?.classList.contains('is-collapsed')
        )
        ? (windowActions.getBoundingClientRect().height || 0) + 32
        : 0;

      return Math.ceil(playerHeight + nowPlayingHeight + playerActionsHeight);
    }

    function updateButtonState() {
      updateFrame = null;
      const playerOffset = getPlayerOffset();
      const hasNowPlayingCompanion = button.classList.contains('has-now-playing-companion');
      const isNearTop = window.scrollY <= TOP_HIDE_SCROLL_Y;

      if (isNearTop) {
        isScrolling = false;
        isPointerOver = false;
        window.clearTimeout(hideTimer);
      }

      const shouldShow = !isNearTop && window.scrollY > SHOW_SCROLL_Y && (isScrolling || isPointerOver || hasNowPlayingCompanion);

      button.style.setProperty('--back-to-top-player-offset', `${playerOffset}px`);
      button.classList.toggle('is-visible', shouldShow);
      button.classList.toggle('is-player-visible', playerOffset > 0);
    }

    function requestButtonUpdate() {
      if (updateFrame !== null) return;
      updateFrame = requestAnimationFrame(updateButtonState);
    }

    function scheduleHide() {
      window.clearTimeout(hideTimer);
      if (isPointerOver) return;

      hideTimer = window.setTimeout(() => {
        isScrolling = false;
        requestButtonUpdate();
      }, HIDE_DELAY_MS);
    }

    function showWhileScrolling() {
      isScrolling = true;
      requestButtonUpdate();
      scheduleHide();
    }

    function holdButtonVisible() {
      isPointerOver = true;
      isScrolling = true;
      window.clearTimeout(hideTimer);
      requestButtonUpdate();
    }

    button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      scheduleHide();
      window.setTimeout(requestButtonUpdate, 300);
      window.setTimeout(requestButtonUpdate, 700);
    });

    button.addEventListener('pointerdown', holdButtonVisible);
    button.addEventListener('touchstart', holdButtonVisible, { passive: true });
    button.addEventListener('pointerup', () => {
      isPointerOver = false;
      scheduleHide();
    });
    button.addEventListener('pointercancel', () => {
      isPointerOver = false;
      scheduleHide();
    });

    button.addEventListener('pointerenter', holdButtonVisible);

    button.addEventListener('pointerleave', () => {
      isPointerOver = false;
      scheduleHide();
    });

    window.addEventListener('scroll', showWhileScrolling, { passive: true });
    window.addEventListener('resize', requestButtonUpdate);
    window.visualViewport?.addEventListener('resize', requestButtonUpdate);
    button.addEventListener('now-playing-companion-change', requestButtonUpdate);

    const fixedPlayer = document.getElementById('fixedPlayer');
    if (fixedPlayer) {
      const observer = new MutationObserver(requestButtonUpdate);
      observer.observe(fixedPlayer, { attributes: true, attributeFilter: ['style', 'class'] });
    }

    const playerFrameWrapper = document.getElementById('playerFrameWrapper');
    if (playerFrameWrapper) {
      const observer = new MutationObserver(requestButtonUpdate);
      observer.observe(playerFrameWrapper, { attributes: true, attributeFilter: ['style', 'class'] });
    }

    const nowPlayingWrapper = document.getElementById('nowPlayingWrapper');
    if (nowPlayingWrapper) {
      const observer = new MutationObserver(requestButtonUpdate);
      observer.observe(nowPlayingWrapper, { attributes: true, childList: true, subtree: true });
    }

    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(requestButtonUpdate);
      if (fixedPlayer) resizeObserver.observe(fixedPlayer);
      if (playerFrameWrapper) resizeObserver.observe(playerFrameWrapper);
      if (nowPlayingWrapper) resizeObserver.observe(nowPlayingWrapper);
    }

    updateButtonState();
  }

  window.LoadingStatus = Object.freeze({
    showVideoListLoading,
    showVideoListPreparing,
    showVideoListRendering,
    showVideoListError
  });

  showVideoListLoading();
  setupBackToTopButton();
})();
