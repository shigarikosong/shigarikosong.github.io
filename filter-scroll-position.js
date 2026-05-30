(function () {
  const filterSection = document.getElementById("filterSection");
  const videoList = document.getElementById("videoList");
  const fixedPlayer = document.getElementById("fixedPlayer");

  if (!filterSection || !videoList) return;

  let shouldScrollAfterListUpdate = false;

  function isPlayerOpen() {
    return Boolean(
      fixedPlayer &&
      getComputedStyle(fixedPlayer).display !== "none"
    );
  }

  function scrollToFilterTop(options = {}) {
    const { behavior = "smooth" } = options;
    const countElement = document.getElementById("songCount");
    window.ScrollUtils.scrollElementIntoComfortView(countElement || filterSection || videoList, { behavior });
  }

  function scrollAfterFilterUpdate(options = {}) {
    const { behavior = "smooth" } = options;
    const playingItem = videoList.querySelector(".playing");
    const filteredOutNotice = document.getElementById("nowPlayingFilteredOutNotice");

    if (isPlayerOpen() && playingItem) {
      window.ScrollUtils.scrollElementIntoComfortView(playingItem, { behavior });
      return;
    }

    if (filteredOutNotice) {
      window.ScrollUtils.scrollElementIntoComfortView(filteredOutNotice, { behavior });
      return;
    }

    scrollToFilterTop({ behavior });
  }

  function requestScrollAfterFilterUpdate(options = {}) {
    const { behavior = "smooth", waitForSettledLayout = false } = options;

    requestAnimationFrame(() => {
      if (!waitForSettledLayout) {
        scrollAfterFilterUpdate({ behavior });
        return;
      }

      requestAnimationFrame(() => scrollAfterFilterUpdate({ behavior }));
    });

    if (!waitForSettledLayout) return;

    window.setTimeout(() => scrollAfterFilterUpdate({ behavior }), 120);
    window.setTimeout(() => scrollAfterFilterUpdate({ behavior }), 320);
  }

  document.addEventListener("click", event => {
    if (event.target.closest("#videoList button[data-filter-group]")) {
      return;
    }

    if (
      event.target.closest("#videoList button") ||
      event.target.closest("#desktopFilterPanel button") ||
      event.target.closest("#filterModal button") ||
      event.target.closest("#activeTagChips button") ||
      event.target.closest("#resetFilters") ||
      event.target.closest("#applyFilters")
    ) {
      shouldScrollAfterListUpdate = true;
    }
  });

  document.addEventListener("input", event => {
    if (event.target.matches("#searchInput, #modalSearchInput")) {
      shouldScrollAfterListUpdate = true;
    }
  });

  document.addEventListener("change", event => {
    if (event.target.matches("#sortOrder, #modalSortOrder")) {
      shouldScrollAfterListUpdate = true;
    }
  });

  const observer = new MutationObserver(() => {
    if (!shouldScrollAfterListUpdate) return;

    shouldScrollAfterListUpdate = false;
    requestScrollAfterFilterUpdate();
  });

  observer.observe(videoList, { childList: true });

  window.FilterScrollPosition = Object.freeze({
    requestScrollAfterFilterUpdate
  });
})();
