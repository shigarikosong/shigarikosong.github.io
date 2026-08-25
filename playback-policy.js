(() => {
  function shouldCueYouTubeVideo(options = {}) {
    if (options.manualPlayEnabled) return true;
    return options.autoplay === false;
  }

  window.PlaybackPolicy = Object.freeze({
    shouldCueYouTubeVideo
  });
})();
