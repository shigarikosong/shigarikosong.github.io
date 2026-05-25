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

  function scrollToFilterTop() {
    const targetTop = filterSection.getBoundingClientRect().top + window.scrollY - 8;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth"
    });
  }

  function scrollNoticeIntoView(notice) {
    notice.scrollIntoView({ behavior: "smooth", block: "center" });

    setTimeout(() => {
      if (document.body.contains(notice)) {
        notice.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);
  }

  function scrollAfterFilterUpdate() {
    const playingItem = videoList.querySelector(".playing");
    const filteredOutNotice = document.getElementById("nowPlayingFilteredOutNotice");

    if (isPlayerOpen() && playingItem) {
      playingItem.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (filteredOutNotice) {
      scrollNoticeIntoView(filteredOutNotice);
      return;
    }

    scrollToFilterTop();
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
    requestAnimationFrame(scrollAfterFilterUpdate);
  });

  observer.observe(videoList, { childList: true });
})();
