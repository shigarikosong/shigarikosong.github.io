(() => {
  const TRANSITIONS = Object.freeze({
    none: Object.freeze({
      type: "none",
      autoplay: false,
      autoPlayableOnly: false
    }),
    replay: Object.freeze({
      type: "replay",
      autoplay: true,
      autoPlayableOnly: false
    }),
    next: Object.freeze({
      type: "next",
      autoplay: true,
      autoPlayableOnly: true
    }),
    random: Object.freeze({
      type: "random",
      autoplay: true,
      autoPlayableOnly: true
    })
  });

  function getVideoEndTransition(options = {}) {
    const repeatMode = String(options.repeatMode || "off");

    if (repeatMode === "one") return TRANSITIONS.replay;
    if (repeatMode !== "all") return TRANSITIONS.none;
    return options.randomEnabled ? TRANSITIONS.random : TRANSITIONS.next;
  }

  function isAutoPlayableVideo(video) {
    const platform = String(video?._platform || video?.platform || "")
      .trim()
      .toLowerCase();
    return platform !== "tiktok";
  }

  window.PlaybackTransitionPolicy = Object.freeze({
    getVideoEndTransition,
    isAutoPlayableVideo
  });
})();
