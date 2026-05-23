(() => {
  const EXCLUDE_BUTTON_CLASS = "tag-exclusion-active";
  const EXCLUDE_CHIP_CLASS = "tag-exclusion-chip";
  const MOBILE_CHIPS_ID = "mobileModalActiveChips";
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
    role: new Set(["VOCAL", "DANCE", "CHORUS", "MOVIE", "ILLUSTRATION", "PIANO", "EUPHONIUM", "KALIMBA"]),
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
  let mobileChipsObserver = null;

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

    .filter-modal-title-hidden {
      display: none !important;
    }

    .mobile-modal-active-chips {
      margin-bottom: 12px;
    }

    .mobile-modal-active-chips.is-empty {
      display: none;
    }

    .mobile-modal-active-chips-inner {
      display: flex;
      flex-wrap: nowrap;
      gap: 0.375rem;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      border: 1px solid rgba(226, 232, 240, 0.9);
      background: rgba(248, 250, 252, 0.92);
      border-radius: 0.75rem;
      padding: 0.5rem 0.75rem;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
    }

    .mobile-modal-active-chips-inner::-webkit-scrollbar {
      display: none;
    }

    .mobile-modal-active-chips-inner button {
      flex: 0 0 auto;
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

  function normalizeFilterGroup(group) {
    return group === "time" ? "date" : group;
  }

  function getRawButtonLabel(button) {
    return String(button.dataset.tagExclusionLabel || button.textContent || "")
      .replace(/^[-−]\s*/, "")
      .trim();
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

  function isFlagFormat(kind, label) {
    return kind === "format" && (label === "3D" || label === "Shorts");
  }

  function clearInclude(kind, label) {
    const value = normalizeLabel(kind, label);

    if (kind === "category" && selectedCategoryTag === value) {
      selectedCategoryTag = "";
    } else if (kind === "platform" && selectedPlatformTag === value) {
      selectedPlatformTag = "";
    } else if (kind === "date" && selectedDateTag === value) {
      selectedDateTag = "";
    } else if (kind === "role" && selectedRoleTag === value) {
      selectedRoleTag = "";
    } else if (kind === "collab" && selectedCollabTag === value) {
      selectedCollabTag = "";
    } else if (isFlagFormat(kind, value) || kind === "flag") {
      if (value === "3D") selected3DTag = null;
      if (value === "Shorts") selectedShortsTag = null;
    } else if (kind === "format") {
      selectedVideoTypeTags.delete(value);
    }
  }

  function setInclude(kind, label) {
    const value = normalizeLabel(kind, label);
    if (!value) return;

    removeExclude(kind, value);

    if (kind === "category") {
      selectedCategoryTag = value;
    } else if (kind === "platform") {
      selectedPlatformTag = value;
    } else if (kind === "date") {
      selectedDateTag = value;
    } else if (kind === "role") {
      selectedRoleTag = value;
    } else if (kind === "collab") {
      selectedCollabTag = value;
    } else if (isFlagFormat(kind, value) || kind === "flag") {
      if (value === "3D") selected3DTag = "include";
      if (value === "Shorts") selectedShortsTag = "include";
    } else if (kind === "format") {
      selectedVideoTypeTags.add(value);
    }
  }

  function getTagState(kind, label) {
    const value = normalizeLabel(kind, label);

    if (isExcluded(kind, value)) return "exclude";
    if (kind === "category" && selectedCategoryTag === value) return "include";
    if (kind === "platform" && selectedPlatformTag === value) return "include";
    if (kind === "date" && selectedDateTag === value) return "include";
    if (kind === "role" && selectedRoleTag === value) return "include";
    if (kind === "collab" && selectedCollabTag === value) return "include";
    if ((isFlagFormat(kind, value) || kind === "flag") && value === "3D" && selected3DTag === "include") return "include";
    if ((isFlagFormat(kind, value) || kind === "flag") && value === "Shorts" && selectedShortsTag === "include") return "include";
    if (kind === "format" && selectedVideoTypeTags.has(value)) return "include";

    return "none";
  }

  function syncFilterControls() {
    if (typeof renderCategoryTags === "function" && Array.isArray(allVideos)) {
      renderCategoryTags([...new Set(allVideos.map(video => video["カテゴリ"]).filter(Boolean))].sort());
    }
    if (typeof renderPlatformTags === "function") renderPlatformTags();
    if (typeof renderDateTags === "function") renderDateTags();
    window.dispatchEvent(new CustomEvent("tagFilterStateChanged"));
  }

  function clearExclude(kind, label) {
    removeExclude(kind, label);
  }

  function cycleTagState(kind, label) {
    const value = normalizeLabel(kind, label);
    const state = getTagState(kind, value);

    if (state === "none") {
      setInclude(kind, value);
    } else if (state === "include") {
      clearInclude(kind, value);
      addExclude(kind, value);
    } else {
      clearInclude(kind, value);
      clearExclude(kind, value);
    }

    syncFilterControls();
    applyFiltersWithExclusions();
  }

  function addExclude(kind, label) {
    const value = normalizeLabel(kind, label);
    if (!value || !excludedTags[kind]) return;
    clearInclude(kind, value);
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
    if (Array.isArray(allVideos)) {
      allVideos.forEach(video => {
        if (video?.["カテゴリ"]) knownTags.category.add(String(video["カテゴリ"]).trim());
        if (video?._platform) knownTags.platform.add(String(video._platform).trim());
        (video?._types || splitTags(video?.["動画種別"])).forEach(tag => knownTags.format.add(tag));
        (video?._roles || splitTags(video?.["担当区分"])).forEach(tag => knownTags.role.add(tag));
        [
          ...(video?._collabLivers || splitTags(video?.["コラボライバー"])),
          ...(video?._collabUnits || splitTags(video?.["コラボユニット"]))
        ].forEach(tag => knownTags.collab.add(tag));
      });
    }

    Object.entries(containerKindMap).forEach(([id, kind]) => {
      const container = document.getElementById(id);
      if (!container) return;

      container.querySelectorAll("button").forEach(button => {
        const label = normalizeLabel(kind, getRawButtonLabel(button));
        if (label) knownTags[kind].add(label);
      });
    });
  }

  function hasClassPart(button, part) {
    return [...button.classList].some(className => className.includes(part));
  }

  function inferCardButtonInfo(button, label) {
    const lowerLabel = label.toLowerCase();

    if (knownTags.flag.has(label)) return { kind: "flag", label };
    if (knownTags.category.has(label)) return { kind: "category", label };
    if (knownTags.platform.has(lowerLabel)) return { kind: "platform", label: lowerLabel };
    if (knownTags.date.has(dateLabelToValue[label] || label)) return { kind: "date", label: dateLabelToValue[label] || label };
    if (knownTags.role.has(label)) return { kind: "role", label };
    if (knownTags.format.has(label)) return { kind: "format", label };
    if (knownTags.collab.has(label)) return { kind: "collab", label };

    if (hasClassPart(button, "pink-")) return { kind: "format", label };
    if (
      hasClassPart(button, "rose-") ||
      hasClassPart(button, "orange-") ||
      hasClassPart(button, "amber-") ||
      hasClassPart(button, "lime-") ||
      hasClassPart(button, "cyan-") ||
      hasClassPart(button, "sky-")
    ) {
      return { kind: "role", label };
    }

    return { kind: "collab", label };
  }

  function findButtonInfo(button) {
    refreshKnownTags();

    const label = getRawButtonLabel(button);
    if (!label || button.closest("#activeTagChips, #mobileModalActiveChips")) return null;
    if (button.classList.contains("collab-member-toggle")) return null;

    const dataKind = normalizeFilterGroup(button.dataset.filterGroup);
    const dataValue = button.dataset.filterValue;
    if (dataKind && dataValue && excludedTags[dataKind]) {
      return { kind: dataKind, label: normalizeLabel(dataKind, dataValue) };
    }

    const container = button.closest(Object.keys(containerKindMap).map(id => `#${id}`).join(","));
    if (container) {
      const kind = containerKindMap[container.id];
      return { kind, label: normalizeLabel(kind, label) };
    }

    if (!button.closest("#videoList")) return null;

    return inferCardButtonInfo(button, label);
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
    if (video?.["3D"] === "TRUE" && (excludedTags.flag.has("3D") || excludedTags.format.has("3D"))) return false;
    if (video?.Shorts === "TRUE" && (excludedTags.flag.has("Shorts") || excludedTags.format.has("Shorts"))) return false;

    return true;
  }

  function filterExcludedVideos(videos) {
    const list = Array.isArray(videos) ? videos : [];
    return hasExclusions() ? list.filter(passesExclusion) : list;
  }

  function ensureMobileModalChips() {
    const modalBody = document.querySelector("#filterModal > div");
    if (!modalBody) return null;

    const title = modalBody.querySelector("h2");
    if (title) title.classList.add("filter-modal-title-hidden");

    let wrapper = document.getElementById(MOBILE_CHIPS_ID);
    if (wrapper) return wrapper;

    wrapper = document.createElement("div");
    wrapper.id = MOBILE_CHIPS_ID;
    wrapper.className = "mobile-modal-active-chips is-empty";
    wrapper.innerHTML = '<div class="mobile-modal-active-chips-inner" aria-label="選択中の絞り込み条件"></div>';

    const inner = wrapper.querySelector(".mobile-modal-active-chips-inner");
    inner.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;

      event.preventDefault();
      const text = button.textContent.trim();
      const sourceButton = [...document.querySelectorAll("#activeTagChipsInner button")]
        .find(source => source.textContent.trim() === text);
      sourceButton?.click();
    });

    if (title) {
      title.insertAdjacentElement("afterend", wrapper);
    } else {
      modalBody.prepend(wrapper);
    }

    return wrapper;
  }

  function syncMobileModalChips() {
    const wrapper = ensureMobileModalChips();
    const source = document.getElementById("activeTagChipsInner");
    const target = wrapper?.querySelector(".mobile-modal-active-chips-inner");
    if (!wrapper || !source || !target) return;

    target.innerHTML = source.innerHTML;
    wrapper.classList.toggle("is-empty", source.children.length === 0);
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
        syncFilterControls();
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

    syncMobileModalChips();
  }

  function syncExcludedButtonLabel(button, info, active) {
    if (!info) return;

    const rawLabel = getRawButtonLabel(button);
    if (rawLabel && !button.dataset.tagExclusionLabel) {
      button.dataset.tagExclusionLabel = rawLabel;
    }

    if (active) {
      button.textContent = `- ${getDisplayLabel(info.kind, info.label)}`;
      return;
    }

    if (button.dataset.tagExclusionLabel) {
      button.textContent = button.dataset.tagExclusionLabel;
      delete button.dataset.tagExclusionLabel;
    }
  }

  function syncExcludeButtonStyles() {
    refreshKnownTags();

    document.querySelectorAll("button").forEach(button => {
      const info = findButtonInfo(button);
      const active = info ? isExcluded(info.kind, info.label) : false;
      button.classList.toggle(EXCLUDE_BUTTON_CLASS, active);
      syncExcludedButtonLabel(button, info, active);
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
      currentFilteredVideos = filtered;
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

    event.preventDefault();
    event.stopImmediatePropagation();
    cycleTagState(info.kind, info.label);
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
    const button = event.target.closest("#resetFilters, #modalResetBtn, #resetModalFilters");
    if (!button) return;

    clearExclusions();
    requestSync();
  }

  function setupMobileChipsObserver() {
    const source = document.getElementById("activeTagChipsInner");
    if (!source || mobileChipsObserver) return;

    mobileChipsObserver = new MutationObserver(syncMobileModalChips);
    mobileChipsObserver.observe(source, { childList: true, subtree: true, characterData: true });
    syncMobileModalChips();
  }

  function setup() {
    const patchedList = patchRenderVideoList();
    const patchedChips = patchRenderActiveTagChips();

    if (!patchedList || !patchedChips) {
      window.setTimeout(setup, 100);
      return;
    }

    setupMobileChipsObserver();
    document.addEventListener("click", handleFilteredPlayback, true);
    document.addEventListener("click", handleTagClick, true);
    document.addEventListener("click", handleResetClick, true);
    requestSync();
  }

  setup();
})();
