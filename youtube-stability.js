(function () {
  let pendingYouTubeVideo = null;
  let retryTimer = null;

  function getYouTubeVideoData(video, options = {}) {
    let videoId = video?.["videoId"];
    const platform = String(video?.["platform"] || "").toLowerCase();

    if (!videoId || !platform.includes("youtube")) return null;

    const match = String(videoId).match(/(?:v=|\/|youtu\.be\/)?([0-9A-Za-z_-]{11})/);
    if (match) videoId = match[1];

    return {
      videoId,
      start: typeof window.parseTimeToSeconds === "function"
        ? window.parseTimeToSeconds(video?.["start"], 0)
        : parseInt(video?.["start"] || "0", 10),
      autoplay: options.autoplay !== false
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

      if (
        (typeof ytPlayer === "undefined" || !ytPlayer) &&
        typeof YT !== "undefined" &&
        typeof YT.Player === "function" &&
        typeof tryInitYtPlayer === "function"
      ) {
        ytApiReady = true;
        tryInitYtPlayer();
      }

      if (typeof ytPlayer !== "undefined" && ytPlayer) {
        const { videoId, start, autoplay } = pendingYouTubeVideo;
        pendingYouTubeVideo = null;

        if (!autoplay && typeof ytPlayer.cueVideoById === "function") {
          ytPlayer.cueVideoById({ videoId, startSeconds: start });
        } else if (typeof ytPlayer.loadVideoById === "function") {
          ytPlayer.loadVideoById({ videoId, startSeconds: start });
        } else if (typeof ytPlayer.cueVideoById === "function") {
          ytPlayer.cueVideoById({ videoId, startSeconds: start });
        }
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

  loadVideo = function (video, item, options = {}) {
    const youtubeVideo = getYouTubeVideoData(video, options);
    if (youtubeVideo) {
      pendingYouTubeVideo = youtubeVideo;
    } else {
      pendingYouTubeVideo = null;
    }

    originalLoadVideo(video, item, options);
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
