(function () {
  const fixedPlayer = document.getElementById("fixedPlayer");
  const fixedPlayerInner = fixedPlayer?.firstElementChild;
  const playerFrameWrapper = document.getElementById("playerFrameWrapper");
  const nowPlayingWrapper = document.getElementById("nowPlayingWrapper");
  const nowPlayingTitle = document.getElementById("nowPlayingTitle");
  const playerControls = document.getElementById("playerControls");
  const closeButton = document.getElementById("closePlayerBtn");

  if (!fixedPlayer || !fixedPlayerInner || !nowPlayingWrapper || !playerControls || !closeButton) return;

  const style = document.createElement("style");
  style.textContent = `
    #fixedPlayer {
      background: transparent !important;
      border-top: 0 !important;
      box-shadow: none !important;
      pointer-events: none;
    }

    #fixedPlayer > div {
      padding: 8px 12px 10px !important;
      pointer-events: auto;
      transition: padding 0.22s ease;
    }

    #fixedPlayer.is-collapsed {
      pointer-events: none;
    }

    #fixedPlayer.is-collapsed > div {
      padding: 0 12px !important;
      pointer-events: none;
    }

    #fixedPlayer.is-collapsed #playerFrameWrapper {
      height: 0 !important;
      min-height: 0 !important;
      opacity: 0;
      visibility: hidden;
      overflow: hidden;
      pointer-events: none;
      box-shadow: none;
    }

    #fixedPlayer.is-collapsed .player-window-actions {
      top: -36px;
      pointer-events: auto;
    }

    #playerFrameWrapper {
      border-radius: 10px;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.24);
      transition: opacity 0.18s ease, box-shadow 0.18s ease;
    }

    .player-window-actions {
      position: absolute;
      top: -6px;
      right: 8px;
      z-index: 8;
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .player-window-button,
    .player-window-icon-button {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid rgba(148, 163, 184, 0.45);
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.82);
      color: #374151;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.1);
      font-size: 14px;
      font-weight: 700;
      line-height: 1;
      opacity: 0.72;
      transition: background 0.2s ease, color 0.2s ease, opacity 0.2s ease, transform 0.1s ease;
    }

    .player-window-button:hover,
    .player-window-icon-button:hover {
      background: #ffffff;
      color: #2563eb;
      opacity: 1;
    }

    .player-window-button:active,
    .player-window-icon-button:active {
      transform: scale(0.96);
    }

    #nowPlayingWrapper {
      padding: 3px 12px;
      box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.08);
    }

    #nowPlayingWrapper.hidden {
      display: none;
    }

    #nowPlaying {
      box-sizing: border-box;
      overflow: hidden;
      padding: 3px 12px !important;
      border-radius: 999px;
      background: rgba(31, 63, 122, 0.92);
      color: #ffffff;
      font-size: 13px;
      line-height: 1.25;
    }

    #nowPlayingTitle {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    #nowPlayingTitle.now-playing-marquee {
      text-overflow: clip;
    }

    .now-playing-marquee-track {
      display: inline-flex;
      max-width: none;
      white-space: nowrap;
      will-change: transform;
    }

    .now-playing-marquee-text {
      flex: 0 0 auto;
    }

    #playerControls {
      flex-wrap: wrap;
      padding: 3px 10px !important;
    }

    @media (min-width: 769px) {
      #nowPlayingWrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
      }

      #nowPlaying {
        flex: 0 1 auto;
        width: fit-content;
        min-width: 0;
        max-width: min(56vw, 680px);
        font-weight: 700;
        text-align: center;
      }

      #playerControls {
        flex: 0 0 auto;
        flex-wrap: nowrap;
        padding: 0 !important;
      }
    }

    @media (max-width: 768px) {
      #nowPlayingWrapper {
        display: block;
        padding-top: 3px;
        padding-bottom: 4px;
      }

      #nowPlaying {
        width: fit-content;
        max-width: min(96vw, 100%);
        margin: 0 auto;
        font-weight: 700;
        text-align: center;
      }
    }
  `;
  document.head.appendChild(style);

  const MARQUEE_IDLE_MS = 8000;
  const MARQUEE_SPEED_PX_PER_SECOND = 24;
  const MARQUEE_MIN_SCROLL_MS = 10000;
  const MARQUEE_RESIZE_SETTLE_MS = 1000;
  const DESKTOP_NOW_PLAYING_QUERY = "(min-width: 769px)";
  let marqueeAnimation = null;
  let marqueeTimer = null;
  let marqueeRefreshFrame = null;
  let marqueeResizeTimer = null;
  let lastMeasuredTitleWidth = 0;

  function cancelNowPlayingMarquee() {
    if (marqueeResizeTimer !== null) {
      clearTimeout(marqueeResizeTimer);
      marqueeResizeTimer = null;
    }

    if (marqueeTimer !== null) {
      clearTimeout(marqueeTimer);
      marqueeTimer = null;
    }

    if (marqueeAnimation) {
      marqueeAnimation.cancel();
      marqueeAnimation = null;
    }
  }

  function getNowPlayingLabel(fallbackLabel) {
    return String(
      fallbackLabel ??
      nowPlayingTitle.dataset.nowPlayingMarqueeLabel ??
      nowPlayingTitle.title ??
      nowPlayingTitle.textContent ??
      ""
    );
  }

  function renderPlainNowPlayingLabel(label) {
    cancelNowPlayingMarquee();
    nowPlayingTitle.classList.remove("now-playing-marquee");
    nowPlayingTitle.textContent = label;
  }

  function startNowPlayingMarquee(track, distance) {
    const scrollDuration = Math.max(
      MARQUEE_MIN_SCROLL_MS,
      Math.round((distance / MARQUEE_SPEED_PX_PER_SECOND) * 1000)
    );

    const runCycle = () => {
      marqueeTimer = window.setTimeout(() => {
        marqueeTimer = null;
        track.style.transform = "translateX(0px)";
        marqueeAnimation = track.animate(
          [
            { transform: "translateX(0px)" },
            { transform: `translateX(-${distance}px)` }
          ],
          {
            duration: scrollDuration,
            easing: "linear",
            fill: "forwards"
          }
        );
        marqueeAnimation.onfinish = () => {
          marqueeAnimation = null;
          track.style.transform = "translateX(0px)";
          runCycle();
        };
      }, MARQUEE_IDLE_MS);
    };

    runCycle();
  }

  function isDesktopNowPlayingLayout() {
    return window.matchMedia?.(DESKTOP_NOW_PLAYING_QUERY).matches ?? window.innerWidth >= 769;
  }

  function scheduleNowPlayingMarqueeRefreshAfterResize() {
    if (marqueeResizeTimer !== null) clearTimeout(marqueeResizeTimer);

    marqueeResizeTimer = window.setTimeout(() => {
      marqueeResizeTimer = null;
      refreshNowPlayingMarquee();
    }, MARQUEE_RESIZE_SETTLE_MS);
  }

  function refreshNowPlayingMarquee(fallbackLabel) {
    if (marqueeRefreshFrame !== null) {
      cancelAnimationFrame(marqueeRefreshFrame);
      marqueeRefreshFrame = null;
    }

    const label = getNowPlayingLabel(fallbackLabel);
    nowPlayingTitle.dataset.nowPlayingMarqueeLabel = label;
    renderPlainNowPlayingLabel(label);

    marqueeRefreshFrame = requestAnimationFrame(() => {
      marqueeRefreshFrame = null;

      const availableWidth = nowPlayingTitle.clientWidth;
      const textWidth = nowPlayingTitle.scrollWidth;
      lastMeasuredTitleWidth = availableWidth;

      if (!availableWidth || textWidth <= availableWidth + 1) return;
      if (typeof nowPlayingTitle.animate !== "function") return;

      const gap = Math.max(48, Math.round(availableWidth * 0.18));
      const track = document.createElement("span");
      const firstText = document.createElement("span");
      const secondText = document.createElement("span");

      firstText.className = "now-playing-marquee-text";
      secondText.className = "now-playing-marquee-text";
      firstText.textContent = label;
      secondText.textContent = label;
      secondText.setAttribute("aria-hidden", "true");

      track.className = "now-playing-marquee-track";
      track.style.columnGap = `${gap}px`;
      track.append(firstText, secondText);

      nowPlayingTitle.textContent = "";
      nowPlayingTitle.classList.add("now-playing-marquee");
      nowPlayingTitle.appendChild(track);

      requestAnimationFrame(() => {
        const distance = Math.ceil(firstText.getBoundingClientRect().width + gap);
        if (distance > 0) startNowPlayingMarquee(track, distance);
      });
    });
  }

  window.NowPlayingMarquee = Object.freeze({
    refresh: refreshNowPlayingMarquee
  });

  const actions = document.createElement("div");
  actions.className = "player-window-actions";

  const collapseButton = document.createElement("button");
  collapseButton.id = "collapsePlayerBtn";
  collapseButton.type = "button";
  collapseButton.className = "player-window-button";

  closeButton.className = "player-window-icon-button";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "プレイヤーを閉じる");

  actions.appendChild(collapseButton);
  actions.appendChild(closeButton);
  fixedPlayerInner.prepend(actions);

  if (playerFrameWrapper) {
    playerFrameWrapper.classList.remove("shadow-lg");
  }

  function isPlayerVisible() {
    return getComputedStyle(fixedPlayer).display !== "none";
  }

  function isCollapsed() {
    return fixedPlayer.classList.contains("is-collapsed");
  }

  function syncButtons() {
    const collapsed = isCollapsed();
    collapseButton.textContent = collapsed ? "▲" : "▼";
    collapseButton.title = collapsed ? "開く" : "小さくする";
    collapseButton.setAttribute(
      "aria-label",
      collapsed ? "プレイヤーを開く" : "プレイヤーを小さくする"
    );
  }

  function setMiniBarPadding() {
    const h = nowPlayingWrapper.offsetHeight || 0;
    document.body.style.paddingBottom = `${h + 12}px`;
  }

  function readjustExpandedPlayer() {
    if (typeof window.adjustFixedPlayerBottom === "function") {
      window.adjustFixedPlayerBottom();
    } else {
      window.dispatchEvent(new Event("resize"));
    }
  }

  function showMiniBarIfPlaying() {
    if (!isPlayerVisible()) return;

    nowPlayingWrapper.classList.remove("hidden");
    refreshNowPlayingMarquee();

    if (isCollapsed()) {
      setMiniBarPadding();
    } else {
      readjustExpandedPlayer();
    }

    syncButtons();
  }

  function collapsePlayer() {
    if (!isPlayerVisible()) return;

    nowPlayingWrapper.classList.remove("hidden");
    fixedPlayer.classList.add("is-collapsed");
    refreshNowPlayingMarquee();
    syncButtons();
    setMiniBarPadding();
  }

  function restorePlayer() {
    fixedPlayer.classList.remove("is-collapsed");
    refreshNowPlayingMarquee();
    syncButtons();
    readjustExpandedPlayer();
  }

  function togglePlayerSize() {
    if (isCollapsed()) {
      restorePlayer();
    } else {
      collapsePlayer();
    }
  }

  function hideMiniBar() {
    cancelNowPlayingMarquee();
    fixedPlayer.classList.remove("is-collapsed");
    nowPlayingWrapper.classList.add("hidden");
    document.body.style.paddingBottom = "0px";
    syncButtons();
  }

  collapseButton.addEventListener("click", togglePlayerSize);
  closeButton.addEventListener("click", hideMiniBar);

  const observer = new MutationObserver(showMiniBarIfPlaying);
  observer.observe(fixedPlayer, {
    attributes: true,
    attributeFilter: ["class", "style"]
  });

  window.addEventListener("resize", () => {
    if (isCollapsed()) setMiniBarPadding();
    if (isDesktopNowPlayingLayout()) {
      scheduleNowPlayingMarqueeRefreshAfterResize();
    } else {
      refreshNowPlayingMarquee();
    }
  });

  if ("ResizeObserver" in window) {
    const titleResizeObserver = new ResizeObserver(() => {
      const currentWidth = nowPlayingTitle.clientWidth;
      if (Math.abs(currentWidth - lastMeasuredTitleWidth) < 1) return;
      if (isDesktopNowPlayingLayout()) {
        scheduleNowPlayingMarqueeRefreshAfterResize();
      } else {
        refreshNowPlayingMarquee();
      }
    });
    titleResizeObserver.observe(nowPlayingTitle);
  }

  syncButtons();
  refreshNowPlayingMarquee();
})();
