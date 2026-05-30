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

  function isVideoListRequest(input) {
    const url = String(input?.url || input || '');
    return url.includes('シート1') || url.includes('%E3%82%B7%E3%83%BC%E3%83%881') || url.includes('data/videos.json');
  }

  function getRequestUrl(input) {
    return String(input?.url || input || '');
  }

  function isOpenSheetRequest(input) {
    const url = getRequestUrl(input);
    return url.includes('opensheet.elk.sh') || url.includes('data/videos.json') || url.includes('data/meta.json');
  }

  function createEmptyArrayResponse() {
    return new Response('[]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  function normalizeOpenSheetData(data, url, shouldWatch) {
    if (!Array.isArray(data)) {
      console.error('opensheet response was not an array', { url, data });
      if (shouldWatch) setStatus(errorMessage, true, true);
      return [];
    }

    if (shouldWatch && data.some(video => !video || !video.title || !video.videoId)) {
      console.error('opensheet video list is missing required fields', { url });
      setStatus(errorMessage, true, true);
      return [];
    }

    return data;
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

  function installArrayGuards(retries = 20) {
    let installed = false;

    if (typeof window.populateFilters === 'function' && !window.populateFilters.isArrayGuarded) {
      const originalPopulateFilters = window.populateFilters;
      window.populateFilters = function guardedPopulateFilters(videos) {
        if (!Array.isArray(videos)) {
          console.error('populateFilters expected an array', { videos });
          videos = [];
        }
        return originalPopulateFilters(videos);
      };
      window.populateFilters.isArrayGuarded = true;
      installed = true;
    }

    if (typeof window.renderVideoList === 'function' && !window.renderVideoList.isArrayGuarded) {
      const originalRenderVideoList = window.renderVideoList;
      window.renderVideoList = function guardedRenderVideoList(videos) {
        if (!Array.isArray(videos)) {
          console.error('renderVideoList expected an array', { videos });
          videos = [];
        }
        return originalRenderVideoList(videos);
      };
      window.renderVideoList.isArrayGuarded = true;
      installed = true;
    }

    if (typeof window.loadVideo === 'function' && !window.loadVideo.isEmptyGuarded) {
      const originalLoadVideo = window.loadVideo;
      window.loadVideo = function guardedLoadVideo(video, item) {
        if (!video) return;
        return originalLoadVideo(video, item);
      };
      window.loadVideo.isEmptyGuarded = true;
      installed = true;
    }

    if (!installed && retries > 0) {
      window.setTimeout(() => installArrayGuards(retries - 1), 50);
    }
  }

  const originalFetch = window.fetch.bind(window);
  setStatus('動画リストを読み込んでいます...', false, true);
  setupBackToTopButton();

  window.fetch = (input, init) => {
    const shouldWatch = isVideoListRequest(input);
    const shouldGuard = isOpenSheetRequest(input);
    const url = getRequestUrl(input);

    if (shouldWatch) {
      setStatus('動画リストを読み込んでいます...', false, true);
    }

    return originalFetch(input, init)
      .then(response => {
        if (!shouldGuard) return response;

        if (!response.ok) {
          console.error('opensheet fetch failed', { url, status: response.status });
          if (shouldWatch) setStatus(errorMessage, true, true);
          return createEmptyArrayResponse();
        }

        return new Proxy(response, {
          get(target, prop) {
            if (prop === 'json') {
              return () => target.json()
                .then(data => {
                  const rows = normalizeOpenSheetData(data, url, shouldWatch);

                  if (shouldWatch && rows.length) {
                    setStatus(`${rows.length}件の動画を準備しています...`);

                    requestAnimationFrame(() => {
                      setStatus('リストを表示しています...');
                    });
                  }

                  return rows;
                })
                .catch(error => {
                  console.error('opensheet JSON parse failed', { url, error });
                  if (shouldWatch) setStatus(errorMessage, true, true);
                  return [];
                });
            }

            const value = target[prop];
            return typeof value === 'function' ? value.bind(target) : value;
          }
        });
      })
      .catch(error => {
        if (shouldGuard) {
          console.error('opensheet fetch failed', { url, error });
        }

        if (shouldWatch) {
          setStatus(errorMessage, true, true);
          return createEmptyArrayResponse();
        }

        throw error;
      });
  };

  installArrayGuards();
})();
