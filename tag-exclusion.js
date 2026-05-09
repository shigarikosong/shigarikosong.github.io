(() => {
  const EXCLUDE_BUTTON_CLASS = "tag-exclusion-active";
  const EXCLUDE_CHIP_CLASS = "tag-exclusion-chip";
  const dateLabelToValue = {
    "最近": "recent",
    "1年以内": "year",
    "1年以上前": "old"
  };
  const dateValueToLabel = Object.fromEntries(
    Object.entries(dateLabelToValue).map(([label, value]) => [value, label])
  );
  const excludedTags = {
    category: new Set(),
    platform: new Set(),
    date: new Set(),
    format: new Set(),
    role: new Set(),
    collab: new Set(),
    flag: new Set()
  };
  const knownTags = {
    category: new Set(["ソロ", "コラボ", "あやかき"]),
    platform: new Set(["youtube", "tiktok"]),
    date: new Set(Object.values(dateLabelToValue)),
    format: new Set(),
    role: new Set(),
    collab: new Set(),
    flag: new Set(["3D", "Shorts"])
  };
  const containerKindMap = {
    modalCategoryTags: "category",
    desktopCategoryTags: "category",
    modalPlatformTags: "platform",
    desktopPlatformTags: "platform",
    modalDateTags: "date",
    desktopDateTags: "date",
    modalFormatTags: "format",
    desktopFormatTags: "format",
    modalRoleTags: "role",
    desktopRoleTags: "role",
    modalCollabLiverTags: "collab",
    desktopCollabLiverTags: "collab",
    modalCollabUnitTags: "collab",
    desktopCollabUnitTags: "collab"
  };
  let lastRenderedVideos = [];
  let syncFrame = null;
  let isPatchingRender = false;

  const style = document.createElement("style");
  style.textContent = `
    .${EXCLUDE_BUTTON_CLASS} {
      border-color: #fda4af !important;
      background: #fff1f2 !important;
      color: #be123c !important;
      box-shadow: inset 0 0 0 1px rgba(244, 63, 94, 0.08) !important;
    }

    .${EXCLUDE_CHIP_CLASS} {
      border: 1px solid #fda4af !important;
      background: #fff1f2 !important;
      color: #be123c !important;
    }
  `;
  document.head.appendChild(style);

  function normalizeLabel(kind, label) {
    const value = String(label || "").trim();
    if (kind === "platform") return value.toLowerCase();
    if (kind === "date") return dateLabelToValue[value] || value;
    return value;
  }

  function getDisplayLabel(kind, value) {
    if (kind === "date") return dateValueToLabel[value] || value;
    return value;
  }

  function splitTags(value) {
    return String(value || "")
      .split(",")
      .map(tag => tag.trim())
      .filter(Boolean);
  }

  function parseYmdToTime(value) {
    if (!value) return NaN;

    const normalized = String(value).trim().replaceAll("/", "-");
    const [year, month = "1", day = "1"] = normalized.split("-");
    const date = new Date(Number(year), Number(month) - 1, Number(day));

    return Number.isNaN(date.getTime()) ? NaN : date.getTime();
  }

  function getDiffMonths(video) {
    const videoTime = parseYmdToTime(video?.["公開日"] || video?.["公開月"]);
    if (Number.isNaN(videoTime)) return null;

    return (Date.now() - videoTime) / (1000 * 60 * 60 * 24 * 30);
  }

  function hasExclusions() {
    return Object.values(excludedTags).some(set => set.size > 0);
  }

  function isExcluded(kind, label) {
    return excludedTags[kind]?.has(normalizeLabel(kind, label));
  }

  function addExclude(kind, label) {
    const value = normalizeLabel(kind, label);
    if (!value || !excludedTags[kind]) return;
    excludedTags[kind].add(value);
  }

  function removeExclude(kind, label) {
    const value = normalizeLabel(kind, label);
    if (!value || !excludedTags[kind]) return;
    excludedTags[kind].delete(value);
  }

  function clearExclusions() {
    Object.values(excludedTags).forEach(set => set.clear());
  }

  function refreshKnownTags() {
    Object.entries(containerKindMap).forEach(([id, kind]) => {
      const container = document.getElementById(id);
      if (!container) return;

      container.querySelectorAll("button").forEach(button => {
        const label = normalizeLabel(kind, button.textContent);
        if (label) knownTags[kind].add(label);
      });
    });
  }

  function findButtonInfo(button) {
    refreshKnownTags();

    const label = String(button.textContent || "").trim();
    if (!label || button.closest("#activeTagChips")) return null;

    const container = button.closest(Object.keys(containerKindMap).map(id => `#${id}`).join(","));
    if (container) {
      const kind = containerKindMap[container.id];
      return { kind, label: normalizeLabel(kind, label) };
    }

    if (!button.closest("#videoList")) return null;

    if (knownTags.flag.has(label)) return { kind: "flag", label };
    if (knownTags.category.has(label)) return { kind: "category", label };
    if (knownTags.platform.has(label.toLowerCase())) return { kind: "platform", label: label.toLowerCase() };
    if (knownTags.date.has(dateLabelToValue[label] || label)) return { kind: "date", label: dateLabelToValue[label] || label };
    if (knownTags.format.has(label)) return { kind: "format", label };
    if (knownTags.role.has(label)) return { kind: "role", label };
    if (knownTags.collab.has(label)) return { kind: "collab", label };

    return null;
  }

  function isIncludedButton(button) {
    return button.classList.contains("text-white") && !button.classList.contains(EXCLUDE_BUTTON_CLASS);
  }

  function isExcludedDate(video) {
    if (excludedTags.date.size === 0) return false;

    const diffMonths = getDiffMonths(video);
    if (diffMonths === null) return false;

    return (
      (excludedTags.date.has("recent") && diffMonths <= 3) ||
      (excludedTags.date.has("year") && diffMonths <= 12) ||
      (excludedTags.date.has("old") && diffMonths > 12)
    );
  }

  function passesExclusion(video) {
    if (!hasExclusions()) return true;

    const category = String(video?.["カテゴリ"] || "").trim();
    const platform = String(video?.platform || "").toLowerCase();
    const formats = splitTags(video?.["動画種別"]);
    const roles = splitTags(video?.["担当区分"]);
    const collabs = [
      ...splitTags(video?.["コラボライバー"]),
      ...splitTags(video?.["コラボユニット"])
    ];

    if (category && excludedTags.category.has(category)) return false;
    if (platform && excludedTags.platform.has(platform)) return false;
    if (isExcludedDate(video)) return false;
    if (formats.some(tag => excludedTags.format.has(tag))) return false;
    if (roles.some(tag => excludedTags.role.has(tag))) return false;
    if (collabs.some(tag => excludedTags.collab.has(tag))) return false;
    if (video?.["3D"] === "TRUE" && excludedTags.flag.has("3D")) return false;
    if (video?.Shorts === "TRUE" && excludedTags.flag.has("Shorts")) return false;

    return true;
  }

  function filterExcludedVideos(videos) {
    const list = Array.isArray(videos) ? videos : [];
    return hasExclusions() ? list.filter(passesExclusion) : list;
  }

  function renderExcludeChips() {
    const activeTagChips = document.getElementById("activeTagChips");
    const activeTagChipsInner = document.getElementById("activeTagChipsInner");
    if (!activeTagChips || !activeTagChipsInner) return;

    activeTagChipsInner
      .querySelectorAll(`.${EXCLUDE_CHIP_CLASS}`)
      .forEach(chip => chip.remove());

    const chips = [];
    [
      ["category", excludedTags.category],
      ["platform", excludedTags.platform],
      ["date", excludedTags.date],
      ["flag", excludedTags.flag],
      ["format", excludedTags.format],
      ["role", excludedTags.role],
      ["collab", excludedTags.collab]
    ].forEach(([kind, set]) => {
      set.forEach(label => chips.push({ kind, label }));
    });

    chips.forEach(({ kind, label }) => {
      const chip = document.createElement("button");
      const displayLabel = getDisplayLabel(kind, label);
      chip.type = "button";
      chip.className = `${EXCLUDE_CHIP_CLASS} px-3 py-1 rounded-full text-sm whitespace-nowrap transition`;
      chip.textContent = `- ${displayLabel}`;
      chip.setAttribute("aria-label", `${displayLabel}を除外条件から外す`);
      chip.addEventListener("click", () => {
        removeExclude(kind, label);
        applyFiltersWithExclusions();
      });
      activeTagChipsInner.appendChild(chip);
    });

    if (chips.length > 0) {
      activeTagChips.classList.remove("hidden");
      if (typeof window.updateActiveTagChipsPosition === "function") {
        window.updateActiveTagChipsPosition();
      }
    }
  }

  function syncExcludeButtonStyles() {
    refreshKnownTags();

    document.querySelectorAll("button").forEach(button => {
      const info = findButtonInfo(button);
      const active = info ? isExcluded(info.kind, info.label) : false;
      button.classList.toggle(EXCLUDE_BUTTON_CLASS, active);
      if (active) {
        button.setAttribute("aria-label", `${getDisplayLabel(info.kind, info.label)}を除外中`);
      }
    });

    renderExcludeChips();
  }

  function requestSync() {
    if (syncFrame !== null) return;

    syncFrame = requestAnimationFrame(() => {
      syncFrame = null;
      syncExcludeButtonStyles();
    });
  }

  function applyFiltersWithExclusions() {
    if (typeof window.applyFilters === "function") {
      window.applyFilters();
    }
    requestSync();
  }

  function patchRenderVideoList() {
    if (typeof window.renderVideoList !== "function" || window.renderVideoList.isExcludeWrapped) return false;

    const originalRenderVideoList = window.renderVideoList;
    window.renderVideoList = function renderVideoListWithExclusion(videos) {
      const filtered = filterExcludedVideos(videos);
      lastRenderedVideos = filtered;
      isPatchingRender = true;
      originalRenderVideoList(filtered);
      isPatchingRender = false;
      requestSync();
    };
    window.renderVideoList.isExcludeWrapped = true;

    return true;
  }

  function patchRenderActiveTagChips() {
    if (typeof window.renderActiveTagChips !== "function" || window.renderActiveTagChips.isExcludeWrapped) return false;

    const originalRenderActiveTagChips = window.renderActiveTagChips;
    window.renderActiveTagChips = function renderActiveTagChipsWithExclusion() {
      originalRenderActiveTagChips();
      renderExcludeChips();
    };
    window.renderActiveTagChips.isExcludeWrapped = true;

    return true;
  }

  function handleTagClick(event) {
    const button = event.target.closest("button");
    if (!button || isPatchingRender) return;

    const info = findButtonInfo(button);
    if (!info) return;

    if (isExcluded(info.kind, info.label)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      removeExclude(info.kind, info.label);
      applyFiltersWithExclusions();
      return;
    }

    if (isIncludedButton(button)) {
      window.setTimeout(() => {
        addExclude(info.kind, info.label);
        applyFiltersWithExclusions();
      }, 0);
    }
  }

  function getVisiblePlayingIndex() {
    const cards = [...document.querySelectorAll("#videoList > div")];
    return cards.findIndex(card => card.classList.contains("playing"));
  }

  function playVisibleVideo(video) {
    if (!video || typeof window.loadVideo !== "function") return;
    window.loadVideo(video, null);
  }

  function handleFilteredPlayback(event) {
    if (!hasExclusions() || lastRenderedVideos.length === 0) return;

    const button = event.target.closest("button");
    if (!button) return;

    const id = button.id;
    if (id === "randomPlayButton" || id === "randomFromFilteredBtn") {
      event.preventDefault();
      event.stopImmediatePropagation();
      const randomVideo = lastRenderedVideos[Math.floor(Math.random() * lastRenderedVideos.length)];
      playVisibleVideo(randomVideo);
      return;
    }

    if (id !== "prevButton" && id !== "nextButton") return;

    const currentIndex = getVisiblePlayingIndex();
    if (currentIndex < 0) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const nextIndex = id === "nextButton"
      ? (currentIndex + 1) % lastRenderedVideos.length
      : (currentIndex - 1 + lastRenderedVideos.length) % lastRenderedVideos.length;

    playVisibleVideo(lastRenderedVideos[nextIndex]);
  }

  function handleResetClick(event) {
    const button = event.target.closest("#resetFilters, #modalResetBtn");
    if (!button) return;

    window.setTimeout(() => {
      clearExclusions();
      applyFiltersWithExclusions();
    }, 0);
  }

  function setup() {
    const patchedList = patchRenderVideoList();
    const patchedChips = patchRenderActiveTagChips();

    if (!patchedList || !patchedChips) {
      window.setTimeout(setup, 100);
      return;
    }

    document.addEventListener("click", handleFilteredPlayback, true);
    document.addEventListener("click", handleTagClick, true);
    document.addEventListener("click", handleResetClick, true);
    requestSync();
  }

  setup();
})();
