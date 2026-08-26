(() => {
  const LAYOUT_LANDSCAPE = 'landscape';
  const LAYOUT_SHORTS = 'shorts';
  const LAYOUT_TIKTOK = 'tiktok';
  const DEFAULT_SIZE_PREFERENCE = 360;
  const MIN_LANDSCAPE_HEIGHT = 200;
  const MIN_EMBED_VIEWPORT = 200;
  const ASPECT_RATIOS = Object.freeze({
    [LAYOUT_LANDSCAPE]: 16 / 9,
    [LAYOUT_SHORTS]: 9 / 16,
    [LAYOUT_TIKTOK]: 9 / 16
  });
  const MIN_SIZE_PREFERENCE = MIN_EMBED_VIEWPORT / ASPECT_RATIOS[LAYOUT_LANDSCAPE];

  function clampSizePreference(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return DEFAULT_SIZE_PREFERENCE;
    return Math.max(MIN_SIZE_PREFERENCE, number);
  }

  function resolveLayout(options = {}) {
    const { isTikTok = false, playerAspect = '', isShorts = false } = options;
    if (isTikTok) return LAYOUT_TIKTOK;
    if (playerAspect === '9:16') return LAYOUT_SHORTS;
    if (playerAspect === '16:9') return LAYOUT_LANDSCAPE;
    return isShorts ? LAYOUT_SHORTS : LAYOUT_LANDSCAPE;
  }

  function getAspectRatio(layout = LAYOUT_LANDSCAPE) {
    return ASPECT_RATIOS[layout] || ASPECT_RATIOS[LAYOUT_LANDSCAPE];
  }

  function getPreferredMinimumHeight(layout = LAYOUT_LANDSCAPE) {
    if (layout === LAYOUT_LANDSCAPE) return MIN_LANDSCAPE_HEIGHT;
    return Math.ceil(MIN_EMBED_VIEWPORT / getAspectRatio(layout));
  }

  function calculateSize(preferredSize, layout, available) {
    const ratio = getAspectRatio(layout);
    const requestedSize = clampSizePreference(preferredSize);
    const preferredMinimumHeight = getPreferredMinimumHeight(layout);
    const maxRatioHeight = Math.min(available.height, available.width / ratio);
    const useCompactVerticalSize = (
      ratio < 1 &&
      requestedSize < preferredMinimumHeight &&
      available.width >= MIN_EMBED_VIEWPORT &&
      available.height >= MIN_EMBED_VIEWPORT
    );
    const useCompactLandscapeSize = (
      ratio >= 1 &&
      requestedSize < preferredMinimumHeight &&
      available.width >= MIN_EMBED_VIEWPORT &&
      available.height >= MIN_EMBED_VIEWPORT
    );
    let width;
    let height;

    if (useCompactVerticalSize) {
      height = Math.min(available.height, Math.max(MIN_EMBED_VIEWPORT, requestedSize));
      width = Math.min(available.width, Math.max(MIN_EMBED_VIEWPORT, height * ratio));
    } else if (useCompactLandscapeSize) {
      height = Math.min(available.height, MIN_EMBED_VIEWPORT);
      width = Math.min(
        available.width,
        Math.max(MIN_EMBED_VIEWPORT, requestedSize * ratio)
      );
    } else if (maxRatioHeight >= preferredMinimumHeight) {
      height = Math.max(preferredMinimumHeight, Math.min(requestedSize, maxRatioHeight));
      width = height * ratio;
    } else if (
      available.width >= MIN_EMBED_VIEWPORT &&
      available.height >= MIN_EMBED_VIEWPORT
    ) {
      if (ratio < 1) {
        height = Math.min(available.height, Math.max(MIN_EMBED_VIEWPORT, requestedSize));
        width = Math.min(available.width, Math.max(MIN_EMBED_VIEWPORT, height * ratio));
      } else {
        width = Math.min(available.width, Math.max(MIN_EMBED_VIEWPORT, requestedSize * ratio));
        height = Math.min(available.height, Math.max(MIN_EMBED_VIEWPORT, width / ratio));
      }
    } else if (available.width < MIN_EMBED_VIEWPORT) {
      width = available.width;
      height = Math.min(
        available.height,
        Math.max(Math.min(MIN_EMBED_VIEWPORT, available.height), width / ratio)
      );
    } else {
      height = available.height;
      width = Math.min(
        available.width,
        Math.max(Math.min(MIN_EMBED_VIEWPORT, available.width), height * ratio)
      );
    }

    return {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height))
    };
  }

  window.PlayerSizePolicy = Object.freeze({
    LAYOUT_LANDSCAPE,
    LAYOUT_SHORTS,
    LAYOUT_TIKTOK,
    DEFAULT_SIZE_PREFERENCE,
    MIN_EMBED_VIEWPORT,
    MIN_SIZE_PREFERENCE,
    clampSizePreference,
    resolveLayout,
    getAspectRatio,
    getPreferredMinimumHeight,
    calculateSize
  });
})();
