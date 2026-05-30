(() => {
  // Thin compatibility layer over the existing global filter variables.
  // Keep DOM rendering and filter matching in their current files while callers migrate here.
  const includeGroups = ["category", "platform", "date", "format", "role", "collab", "flag"];
  const excludedTags = Object.fromEntries(includeGroups.map(group => [group, new Set()]));

  function normalizeGroup(group) {
    return group === "time" ? "date" : group;
  }

  function normalizeValue(group, value) {
    const normalizedGroup = normalizeGroup(group);
    const normalizedValue = String(value || "").trim();
    if (normalizedGroup === "platform") return normalizedValue.toLowerCase();
    if (normalizedGroup === "date") {
      return window.TAG_CONFIG?.dateLabelToValue?.[normalizedValue] || normalizedValue;
    }
    return normalizedValue;
  }

  function isFlagValue(group, value) {
    const normalizedGroup = normalizeGroup(group);
    return (normalizedGroup === "flag" || normalizedGroup === "format") && (value === "3D" || value === "Shorts");
  }

  function getVideoTypeTags() {
    return window.selectedVideoTypeTags instanceof Set
      ? window.selectedVideoTypeTags
      : new Set();
  }

  function getExcludeState() {
    return Object.fromEntries(
      Object.entries(excludedTags).map(([group, set]) => [group, [...set]])
    );
  }

  function setSearchAndSort(partialState) {
    if (Object.prototype.hasOwnProperty.call(partialState, "searchQuery")) {
      const searchInput = document.getElementById("searchInput");
      const modalSearchInput = document.getElementById("modalSearchInput");
      if (searchInput) searchInput.value = partialState.searchQuery || "";
      if (modalSearchInput) modalSearchInput.value = partialState.searchQuery || "";
    }

    if (Object.prototype.hasOwnProperty.call(partialState, "sortOrder")) {
      const value = partialState.sortOrder || "desc";
      const sortOrder = document.getElementById("sortOrder");
      const modalSortOrder = document.getElementById("modalSortOrder");
      if (sortOrder) sortOrder.value = value;
      if (modalSortOrder) modalSortOrder.value = value;
    }
  }

  function clearInclude(group, value) {
    const normalizedGroup = normalizeGroup(group);
    const normalizedValue = normalizeValue(normalizedGroup, value);

    if (normalizedGroup === "category" && window.selectedCategoryTag === normalizedValue) {
      window.selectedCategoryTag = "";
    } else if (normalizedGroup === "platform" && window.selectedPlatformTag === normalizedValue) {
      window.selectedPlatformTag = "";
    } else if (normalizedGroup === "date" && window.selectedDateTag === normalizedValue) {
      window.selectedDateTag = "";
    } else if (normalizedGroup === "role" && window.selectedRoleTag === normalizedValue) {
      window.selectedRoleTag = "";
    } else if (normalizedGroup === "collab" && window.selectedCollabTag === normalizedValue) {
      window.selectedCollabTag = "";
    } else if (isFlagValue(normalizedGroup, normalizedValue)) {
      if (normalizedValue === "3D") window.selected3DTag = null;
      if (normalizedValue === "Shorts") window.selectedShortsTag = null;
    } else if (normalizedGroup === "format") {
      getVideoTypeTags().delete(normalizedValue);
    }
  }

  function setInclude(group, value) {
    const normalizedGroup = normalizeGroup(group);
    const normalizedValue = normalizeValue(normalizedGroup, value);
    if (!normalizedValue) return;

    removeExclude(normalizedGroup, normalizedValue);

    if (normalizedGroup === "category") {
      window.selectedCategoryTag = normalizedValue;
    } else if (normalizedGroup === "platform") {
      window.selectedPlatformTag = normalizedValue;
    } else if (normalizedGroup === "date") {
      window.selectedDateTag = normalizedValue;
    } else if (normalizedGroup === "role") {
      window.selectedRoleTag = normalizedValue;
    } else if (normalizedGroup === "collab") {
      window.selectedCollabTag = normalizedValue;
    } else if (isFlagValue(normalizedGroup, normalizedValue)) {
      if (normalizedValue === "3D") window.selected3DTag = "include";
      if (normalizedValue === "Shorts") window.selectedShortsTag = "include";
    } else if (normalizedGroup === "format") {
      getVideoTypeTags().add(normalizedValue);
    }
  }

  function addExclude(group, value) {
    const normalizedGroup = normalizeGroup(group);
    const normalizedValue = normalizeValue(normalizedGroup, value);
    if (!normalizedValue || !excludedTags[normalizedGroup]) return;
    clearInclude(normalizedGroup, normalizedValue);
    excludedTags[normalizedGroup].add(normalizedValue);
  }

  function removeExclude(group, value) {
    const normalizedGroup = normalizeGroup(group);
    const normalizedValue = normalizeValue(normalizedGroup, value);
    if (!normalizedValue || !excludedTags[normalizedGroup]) return;
    excludedTags[normalizedGroup].delete(normalizedValue);
  }

  function getState() {
    const searchInput = document.getElementById("searchInput");
    const sortOrder = document.getElementById("sortOrder");

    return {
      searchQuery: searchInput?.value || "",
      sortOrder: sortOrder?.value || "desc",
      include: {
        category: window.selectedCategoryTag || "",
        platform: window.selectedPlatformTag || "",
        date: window.selectedDateTag || "",
        format: [...getVideoTypeTags()],
        role: window.selectedRoleTag || "",
        collab: window.selectedCollabTag || "",
        flag: [
          window.selected3DTag === "include" ? "3D" : "",
          window.selectedShortsTag === "include" ? "Shorts" : ""
        ].filter(Boolean)
      },
      exclude: getExcludeState()
    };
  }

  function setState(partialState = {}) {
    setSearchAndSort(partialState);

    const include = partialState.include || partialState;
    if (Object.prototype.hasOwnProperty.call(include, "category")) window.selectedCategoryTag = include.category || "";
    if (Object.prototype.hasOwnProperty.call(include, "platform")) window.selectedPlatformTag = include.platform || "";
    if (Object.prototype.hasOwnProperty.call(include, "date")) window.selectedDateTag = include.date || "";
    if (Object.prototype.hasOwnProperty.call(include, "role")) window.selectedRoleTag = include.role || "";
    if (Object.prototype.hasOwnProperty.call(include, "collab")) window.selectedCollabTag = include.collab || "";
    if (Object.prototype.hasOwnProperty.call(include, "format")) {
      window.selectedVideoTypeTags = new Set(include.format || []);
    }
    if (Object.prototype.hasOwnProperty.call(include, "flag")) {
      const flags = new Set(include.flag || []);
      window.selected3DTag = flags.has("3D") ? "include" : null;
      window.selectedShortsTag = flags.has("Shorts") ? "include" : null;
    }

    if (partialState.exclude) {
      setExcludeState(partialState.exclude);
    }
  }

  function setExcludeState(nextState = {}) {
    Object.entries(excludedTags).forEach(([group, set]) => {
      set.clear();
      (nextState[group] || []).forEach(value => {
        const normalizedValue = normalizeValue(group, value);
        if (normalizedValue) set.add(normalizedValue);
      });
    });
  }

  function resetState(options = {}) {
    const { resetSearch = true, resetSort = true } = options;
    setState({
      searchQuery: resetSearch ? "" : getState().searchQuery,
      sortOrder: resetSort ? "desc" : getState().sortOrder,
      include: {
        category: "",
        platform: "",
        date: "",
        format: [],
        role: "",
        collab: "",
        flag: []
      }
    });
    clearExcludeState();
  }

  function clearExcludeState() {
    Object.values(excludedTags).forEach(set => set.clear());
  }

  function isTagIncluded(group, value) {
    const normalizedGroup = normalizeGroup(group);
    const normalizedValue = normalizeValue(normalizedGroup, value);
    const state = getState().include;

    if (normalizedGroup === "category") return state.category === normalizedValue;
    if (normalizedGroup === "platform") return state.platform === normalizedValue;
    if (normalizedGroup === "date") return state.date === normalizedValue;
    if (normalizedGroup === "role") return state.role === normalizedValue;
    if (normalizedGroup === "collab") return state.collab === normalizedValue;
    if (isFlagValue(normalizedGroup, normalizedValue)) return state.flag.includes(normalizedValue);
    if (normalizedGroup === "format") return state.format.includes(normalizedValue);
    return false;
  }

  function isTagExcluded(group, value) {
    const normalizedGroup = normalizeGroup(group);
    const normalizedValue = normalizeValue(normalizedGroup, value);
    return Boolean(excludedTags[normalizedGroup]?.has(normalizedValue));
  }

  function setTagState(group, value, state) {
    const normalizedGroup = normalizeGroup(group);
    const normalizedValue = normalizeValue(normalizedGroup, value);

    if (state === "include") {
      setInclude(normalizedGroup, normalizedValue);
    } else if (state === "exclude") {
      addExclude(normalizedGroup, normalizedValue);
    } else {
      clearInclude(normalizedGroup, normalizedValue);
      removeExclude(normalizedGroup, normalizedValue);
    }
  }

  function toggleTag(group, value) {
    const normalizedGroup = normalizeGroup(group);
    const normalizedValue = normalizeValue(normalizedGroup, value);

    if (isTagExcluded(normalizedGroup, normalizedValue)) {
      setTagState(normalizedGroup, normalizedValue, "none");
      return "none";
    }

    if (isTagIncluded(normalizedGroup, normalizedValue)) {
      setTagState(normalizedGroup, normalizedValue, "exclude");
      return "exclude";
    }

    setTagState(normalizedGroup, normalizedValue, "include");
    return "include";
  }

  function getExcludedValues(group) {
    const normalizedGroup = normalizeGroup(group);
    return [...(excludedTags[normalizedGroup] || [])];
  }

  function hasExclusions() {
    return Object.values(excludedTags).some(set => set.size > 0);
  }

  function splitTags(value) {
    return String(value || "")
      .split(",")
      .map(tag => tag.trim())
      .filter(Boolean);
  }

  function getVideoDateTime(video) {
    if (Number.isFinite(video?._time)) return video._time;
    return window.DATE_UTILS?.parseYmdToTime?.(video?.["公開日"] || video?.["公開月"]) ?? NaN;
  }

  function isExcludedDate(video) {
    const excludedDates = getExcludedValues("date");
    if (excludedDates.length === 0) return false;

    const videoTime = getVideoDateTime(video);
    if (Number.isNaN(videoTime)) return false;

    const diffMonths = (Date.now() - videoTime) / (1000 * 60 * 60 * 24 * 30);
    return (
      (excludedDates.includes("recent") && diffMonths <= 3) ||
      (excludedDates.includes("year") && diffMonths <= 12) ||
      (excludedDates.includes("old") && diffMonths > 12)
    );
  }

  function passesExclusion(video) {
    if (!hasExclusions()) return true;

    const category = String(video?.["カテゴリ"] || "").trim();
    const platform = String(video?._platform || video?.platform || "").toLowerCase();
    const formats = Array.isArray(video?._types) ? video._types : splitTags(video?.["動画種別"]);
    const roles = Array.isArray(video?._roles) ? video._roles : splitTags(video?.["担当区分"]);
    const collabs = Array.isArray(video?._collabTags)
      ? video._collabTags
      : [
        ...splitTags(video?.["コラボライバー"]),
        ...splitTags(video?.["コラボユニット"])
      ];

    if (category && isTagExcluded("category", category)) return false;
    if (platform && isTagExcluded("platform", platform)) return false;
    if (isExcludedDate(video)) return false;
    if (formats.some(tag => isTagExcluded("format", tag))) return false;
    if (roles.some(tag => isTagExcluded("role", tag))) return false;
    if (collabs.some(tag => isTagExcluded("collab", tag))) return false;
    if ((video?._is3D || video?.["3D"] === "TRUE") && (isTagExcluded("flag", "3D") || isTagExcluded("format", "3D"))) return false;
    if ((video?._isShorts || video?.Shorts === "TRUE") && (isTagExcluded("flag", "Shorts") || isTagExcluded("format", "Shorts"))) return false;

    return true;
  }

  function filterExcludedVideos(videos) {
    const list = Array.isArray(videos) ? videos : [];
    return hasExclusions() ? list.filter(passesExclusion) : list;
  }

  function registerExclusionAdapter() {
    // Kept as a no-op for older extension scripts during the transition.
  }

  window.FilterState = Object.freeze({
    getState,
    setState,
    resetState,
    toggleTag,
    isTagIncluded,
    isTagExcluded,
    getExcludedValues,
    hasExclusions,
    passesExclusion,
    filterExcludedVideos,
    setTagState,
    registerExclusionAdapter
  });
})();
