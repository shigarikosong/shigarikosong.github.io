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
      padding: 2px 12px !important;
      font-size: 13px;
      line-height: 1.25;
    }

    #nowPlayingTitle {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
        min-width: 0;
        max-width: min(56vw, 680px);
        padding: 0 !important;
        font-weight: 700;
        text-align: right;
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
    }
  `;
  document.head.appendChild(style);

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
    syncButtons();
    setMiniBarPadding();
  }

  function restorePlayer() {
    fixedPlayer.classList.remove("is-collapsed");
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
  });

  syncButtons();
})();
