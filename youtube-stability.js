(function () {
  let pendingYouTubeVideo = null;
  let retryTimer = null;

  function getYouTubeVideoData(video) {
    let videoId = video?.["videoId"];
    const platform = String(video?.["platform"] || "").toLowerCase();

    if (!videoId || !platform.includes("youtube")) return null;

    const match = String(videoId).match(/(?:v=|\/|youtu\.be\/)?([0-9A-Za-z_-]{11})/);
    if (match) videoId = match[1];

    return {
      videoId,
      start: parseInt(video?.["start"] || "0", 10)
    };
  }

  function playWhenReady() {
    if (!pendingYouTubeVideo) return;

    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    let attempts = 0;

    const tryPlay = () => {
      if (!pendingYouTubeVideo) return;

      if (typeof ytPlayer !== "undefined" && ytPlayer && typeof ytPlayer.loadVideoById === "function") {
        const { videoId, start } = pendingYouTubeVideo;
        pendingYouTubeVideo = null;
        ytPlayer.loadVideoById({ videoId, startSeconds: start });
        return;
      }

      attempts += 1;
      if (attempts <= 40) {
        retryTimer = setTimeout(tryPlay, 100);
      }
    };

    tryPlay();
  }

  const originalLoadVideo = loadVideo;

  loadVideo = function (video, item) {
    const youtubeVideo = getYouTubeVideoData(video);
    if (youtubeVideo) {
      pendingYouTubeVideo = youtubeVideo;
    } else {
      pendingYouTubeVideo = null;
    }

    originalLoadVideo(video, item);
    playWhenReady();
  };

  const originalOnYouTubeIframeAPIReady = window.onYouTubeIframeAPIReady;

  window.onYouTubeIframeAPIReady = function () {
    if (typeof originalOnYouTubeIframeAPIReady === "function") {
      originalOnYouTubeIframeAPIReady();
    }

    playWhenReady();
  };
})();
