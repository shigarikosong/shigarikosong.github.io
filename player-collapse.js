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
      transition: transform 0.22s ease;
      pointer-events: none;
    }

    #fixedPlayer > div {
      padding: 8px 12px 10px !important;
      pointer-events: auto;
    }

    #fixedPlayer.is-collapsed {
      transform: translateY(calc(100% + 32px));
      pointer-events: none;
    }

    #fixedPlayer.is-collapsed > div {
      pointer-events: none;
    }

    #playerFrameWrapper {
      border-radius: 10px;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.24);
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
      border: 1px solid rgba(148, 163, 184, 0.45);
      background: rgba(255, 255, 255, 0.9);
      color: #374151;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
      transition: background 0.2s ease, color 0.2s ease;
    }

    .player-window-button {
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
    }

    .player-window-icon-button {
      width: 28px;
      height: 28px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 700;
    }

    .player-window-button:hover,
    .player-window-icon-button:hover {
      background: #ffffff;
      color: #2563eb;
    }

    #nowPlayingWrapper {
      padding-top: 2px;
      padding-bottom: 4px;
      box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.08);
    }

    #nowPlaying {
      padding: 4px 12px !important;
      font-size: 14px;
    }

    #nowPlayingTitle {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    #playerControls {
      flex-wrap: wrap;
      padding: 4px 12px !important;
    }
  `;
  document.head.appendChild(style);

  const actions = document.createElement("div");
  actions.className = "player-window-actions";

  const collapseButton = document.createElement("button");
  collapseButton.id = "collapsePlayerBtn";
  collapseButton.type = "button";
  collapseButton.className = "player-window-button";
  collapseButton.textContent = "小さくする";

  closeButton.className = "player-window-icon-button";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "プレイヤーを閉じる");

  actions.appendChild(collapseButton);
  actions.appendChild(closeButton);
  fixedPlayerInner.prepend(actions);

  const restoreButton = document.createElement("button");
  restoreButton.id = "restorePlayerBtn";
  restoreButton.type = "button";
  restoreButton.className = "bg-blue-500 text-white px-3 py-1 rounded text-sm hidden";
  restoreButton.textContent = "開く";
  playerControls.prepend(restoreButton);

  const stopButton = document.createElement("button");
  stopButton.id = "stopPlayerBtn";
  stopButton.type = "button";
  stopButton.className = "bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm";
  stopButton.textContent = "閉じる";
  const randomAutoPlayButton = document.getElementById("randomAutoPlayBtn");
  playerControls.insertBefore(stopButton, randomAutoPlayButton || null);

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
    restoreButton.classList.toggle("hidden", !collapsed);
    collapseButton.classList.toggle("hidden", collapsed);
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

  function hideMiniBar() {
    fixedPlayer.classList.remove("is-collapsed");
    nowPlayingWrapper.classList.add("hidden");
    document.body.style.paddingBottom = "0px";
    syncButtons();
  }

  function stopPlayer() {
    closeButton.click();
    hideMiniBar();
  }

  collapseButton.addEventListener("click", collapsePlayer);
  restoreButton.addEventListener("click", restorePlayer);
  stopButton.addEventListener("click", stopPlayer);
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
