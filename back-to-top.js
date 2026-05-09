(function () {
  const SHOW_SCROLL_Y = 420;
  const button = document.createElement("button");

  button.type = "button";
  button.id = "backToTopButton";
  button.className = "back-to-top-button";
  button.setAttribute("aria-label", "ページトップへ戻る");
  button.textContent = "↑";

  document.body.appendChild(button);

  function getPlayerOffset() {
    const fixedPlayer = document.getElementById("fixedPlayer");
    const nowPlayingWrapper = document.getElementById("nowPlayingWrapper");
    const fixedPlayerVisible = fixedPlayer && getComputedStyle(fixedPlayer).display !== "none";

    if (!fixedPlayerVisible) return 0;

    const playerHeight = fixedPlayer.getBoundingClientRect().height || 0;
    const nowPlayingHeight = nowPlayingWrapper && !nowPlayingWrapper.classList.contains("hidden")
      ? nowPlayingWrapper.getBoundingClientRect().height || 0
      : 0;

    return Math.ceil(playerHeight + nowPlayingHeight);
  }

  function updateButtonState() {
    const playerOffset = getPlayerOffset();
    const shouldShow = window.scrollY > SHOW_SCROLL_Y;

    button.style.setProperty("--back-to-top-player-offset", `${playerOffset}px`);
    button.classList.toggle("is-visible", shouldShow);
    button.classList.toggle("is-player-visible", playerOffset > 0);
  }

  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", updateButtonState, { passive: true });
  window.addEventListener("resize", updateButtonState);
  window.visualViewport?.addEventListener("resize", updateButtonState);

  const fixedPlayer = document.getElementById("fixedPlayer");
  if (fixedPlayer) {
    const observer = new MutationObserver(updateButtonState);
    observer.observe(fixedPlayer, { attributes: true, attributeFilter: ["style", "class"] });
  }

  const nowPlayingWrapper = document.getElementById("nowPlayingWrapper");
  if (nowPlayingWrapper) {
    const observer = new MutationObserver(updateButtonState);
    observer.observe(nowPlayingWrapper, { attributes: true, childList: true, subtree: true });
  }

  updateButtonState();
})();
