(function () {
  const songCount = document.getElementById("songCount");
  const desktopResultCount = document.getElementById("desktopResultCount");
  const desktopResultTotal = document.getElementById("desktopResultTotal");
  const desktopResultVisible = document.getElementById("desktopResultVisible");
  const fixedPlayer = document.getElementById("fixedPlayer");
  const nowPlayingWrapper = document.getElementById("nowPlayingWrapper");

  function syncDesktopResultCount() {
    if (!songCount || !desktopResultCount || !desktopResultTotal || !desktopResultVisible) return;

    const match = songCount.textContent.match(/(\d+)\D+(\d+)/);
    if (!match) return;

    desktopResultTotal.textContent = match[1];
    desktopResultVisible.textContent = match[2];
    desktopResultCount.classList.remove("hidden");
  }

  function isFixedPlayerVisible() {
    if (!fixedPlayer) return false;
    return getComputedStyle(fixedPlayer).display !== "none";
  }

  function syncPlayerControlsVisibility() {
    if (!fixedPlayer || !nowPlayingWrapper) return;

    if (isFixedPlayerVisible()) {
      nowPlayingWrapper.classList.remove("hidden");
      requestAnimationFrame(() => {
        if (typeof adjustFixedPlayerBottom === "function") adjustFixedPlayerBottom();
      });
    } else {
      nowPlayingWrapper.classList.add("hidden");
      document.body.style.paddingBottom = "0px";
    }
  }

  syncDesktopResultCount();
  syncPlayerControlsVisibility();

  if (songCount) {
    const countObserver = new MutationObserver(syncDesktopResultCount);
    countObserver.observe(songCount, { childList: true, characterData: true, subtree: true });
  }

  if (fixedPlayer) {
    const playerObserver = new MutationObserver(syncPlayerControlsVisibility);
    playerObserver.observe(fixedPlayer, { attributes: true, attributeFilter: ["style", "class"] });
  }
})();
