(() => {
  const collator = new Intl.Collator("ja");
  const emptyParsedSearchQuery = Object.freeze({
    excludeTerms: Object.freeze([]),
    groups: Object.freeze([])
  });

  function getIncludeValues(include, group) {
    return Array.isArray(include?.[group]) ? include[group] : [];
  }

  function matchesIncludeQuery(video, options = {}) {
    const include = options.filterState?.include || {};
    const parsedSearchQuery = options.parsedSearchQuery || emptyParsedSearchQuery;
    const now = options.now || new Date();
    const collabTags = getIncludeValues(include, "collab");
    const roleTags = getIncludeValues(include, "role");
    const flags = getIncludeValues(include, "flag");
    const formats = getIncludeValues(include, "format");

    return window.SearchUtils.matchesParsedSearchQuery(video, parsedSearchQuery) &&
      (!include.category || video["カテゴリ"] === include.category) &&
      (
        collabTags.length === 0 ||
        collabTags.some(tag => video._collabTags.includes(tag))
      ) &&
      (
        roleTags.length === 0 ||
        roleTags.some(tag => video._roles.includes(tag))
      ) &&
      (!include.platform || video._platform === include.platform) &&
      window.DATE_UTILS.getDateFilterMatch(include.date, video._time, now) &&
      (!flags.includes("3D") || video._is3D) &&
      (!flags.includes("Shorts") || video._isShorts) &&
      (
        formats.length === 0 ||
        formats.every(tag => video._types.includes(tag))
      );
  }

  function compareVideos(a, b, order) {
    if (order === "asc" || order === "desc") {
      return order === "asc" ? a._time - b._time : b._time - a._time;
    }
    if (order === "title") {
      return collator.compare(String(a["title"] || ""), String(b["title"] || ""));
    }
    if (order === "artist") {
      return collator.compare(String(a["artist"] || ""), String(b["artist"] || ""));
    }
    return 0;
  }

  function filterAndSortVideos(videos, options = {}) {
    const order = options.order || "desc";
    return videos
      .filter(video => matchesIncludeQuery(video, options))
      .sort((a, b) => compareVideos(a, b, order));
  }

  window.VideoQuery = Object.freeze({
    matchesIncludeQuery,
    compareVideos,
    filterAndSortVideos
  });
})();
