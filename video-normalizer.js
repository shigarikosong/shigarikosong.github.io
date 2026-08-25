(() => {
  function parseTimeToSeconds(value, fallback = null) {
    if (value === null || value === undefined || value === "") return fallback;
    if (typeof value === "number") {
      return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
    }

    const text = String(value).trim();
    if (!text) return fallback;
    if (/^\d+(?:\.\d+)?$/.test(text)) return Math.floor(Number(text));

    const parts = text.split(":");
    if (parts.length < 2 || parts.length > 3) return fallback;
    if (!parts.every(part => /^\d+$/.test(part.trim()))) return fallback;

    const numbers = parts.map(part => Number(part.trim()));
    const seconds = numbers.pop();
    const minutes = numbers.pop();
    const hours = numbers.pop() || 0;

    if (minutes > 59 || seconds > 59) return fallback;
    return (hours * 3600) + (minutes * 60) + seconds;
  }

  function parseCommaTags(value) {
    return String(value || "")
      .split(",")
      .map(tag => tag.trim())
      .filter(Boolean);
  }

  function normalizeVideoNumber(value) {
    return String(value ?? "").trim();
  }

  function normalizePlayerAspect(value) {
    const aspect = String(value ?? "").trim();
    return aspect === "9:16" || aspect === "16:9" ? aspect : "";
  }

  function getRuntimeDependencies() {
    if (typeof window.DATE_UTILS?.parseYmdToTime !== "function") {
      throw new TypeError("DATE_UTILS.parseYmdToTime is required");
    }

    return {
      parseYmdToTime: window.DATE_UTILS.parseYmdToTime.bind(window.DATE_UTILS),
      getPlatformLabel: typeof window.TAG_CONFIG?.getPlatformLabel === "function"
        ? window.TAG_CONFIG.getPlatformLabel.bind(window.TAG_CONFIG)
        : null
    };
  }

  function normalizeVideoWithDependencies(video, dependencies) {
    const roles = parseCommaTags(video["担当区分"]);
    const types = parseCommaTags(video["動画種別"]);
    const collabLivers = parseCommaTags(video["コラボライバー"]);
    const collabUnits = parseCommaTags(video["コラボユニット"]);
    const platform = String(video["platform"] || "").trim().toLowerCase();
    const startSeconds = parseTimeToSeconds(video["start"], 0);
    const parsedEndSeconds = parseTimeToSeconds(video["end"], null);
    const endSeconds = parsedEndSeconds !== null && parsedEndSeconds > startSeconds
      ? parsedEndSeconds
      : null;
    const is3D = video["3D"] === "TRUE";
    const isShorts = video["Shorts"] === "TRUE";

    video._roles = roles;
    video._types = types;
    video._collabLivers = collabLivers;
    video._collabUnits = collabUnits;
    video._collabTags = [...collabLivers, ...collabUnits];
    video._platform = platform;
    video._number = normalizeVideoNumber(video["number"]);
    video._fullNumber = normalizeVideoNumber(video["full_number"]);
    video._fullButtonText = String(video["full_button_text"] ?? "").trim();
    video._playerAspect = normalizePlayerAspect(video["player_aspect"]);
    video._is3D = is3D;
    video._isShorts = isShorts;
    video._startSeconds = startSeconds;
    video._endSeconds = endSeconds;
    video._time = dependencies.parseYmdToTime(video["公開日"] || video["公開月"]);
    video._searchText = [
      video["title"],
      video["title_kana"],
      video["artist"],
      video["artist_kana"],
      video["waku_name"],
      video["カテゴリ"],
      video["platform"],
      dependencies.getPlatformLabel?.(platform),
      video["動画種別"],
      video["担当区分"],
      video["コラボライバー"],
      video["コラボユニット"],
      is3D ? "3D" : "",
      isShorts ? "Shorts" : "",
      types.join(" "),
      roles.join(" "),
      collabLivers.join(" "),
      collabUnits.join(" ")
    ].filter(Boolean).join(" ").toLowerCase();

    return video;
  }

  function normalizeVideo(video) {
    return normalizeVideoWithDependencies(video, getRuntimeDependencies());
  }

  function normalizeVideos(data) {
    const dependencies = getRuntimeDependencies();
    return data.map(video => normalizeVideoWithDependencies(video, dependencies));
  }

  window.VideoNormalizer = Object.freeze({
    parseTimeToSeconds,
    normalizeVideo,
    normalizeVideos
  });
})();
