(() => {
  const EXCLUDE_BUTTON_CLASS = "tag-exclusion-active";
  const EXCLUDE_CHIP_CLASS = "tag-exclusion-chip";
  const { categoryOrder, formatOrder, roleOrder, dateLabelToValue, platformValues } = window.TAG_CONFIG;
  const dateValueToLabel = Object.fromEntries(
    Object.entries(dateLabelToValue).map(([label, value]) => [value, label])
  );
  const filterGroups = ["category", "platform", "date", "format", "role", "collab", "flag"];
  const knownTags = {
    category: new Set(categoryOrder),
    platform: new Set(platformValues),
    date: new Set(Object.values(dateLabelToValue)),
    format: new Set(),
    role: new Set(roleOrder),
    collab: new Set(),
    flag: new Set(formatOrder.filter(tag => tag === "3D" || tag === "Shorts"))
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
  const tagSyncButtonSelector = [
    "#modalCategoryTags button",
    "#desktopCategoryTags button",
    "#modalPlatformTags button",
    "#desktopPlatformTags button",
    "#modalDateTags button",
    "#desktopDateTags button",
    "#modalFormatTags button",
    "#desktopFormatTags button",
    "#modalRoleTags button",
    "#desktopRoleTags button",
    "#modalCollabLiverTags button",
    "#desktopCollabLiverTags button",
    "#modalCollabUnitTags button",
    "#desktopCollabUnitTags button",
    "#videoList [data-filter-group]",
    "#activeTagChips button"
  ].join(",");
  let syncFrame = null;

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
    if (kind === "platform") return window.TAG_CONFIG.getPlatformLabel(value);
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

  function hasExclusions() {
    return window.FilterState.hasExclusions();
  }

  function isExcluded(kind, label) {
    return window.FilterState.isTagExcluded(kind, label);
  }

  function setInclude(kind, label) {
    const value = normalizeLabel(kind, label);
    if (!value) return;

    window.FilterState.setTagState(kind, value, "include");
  }

  function getTagState(kind, label) {
    const value = normalizeLabel(kind, label);

    if (isExcluded(kind, value)) return "exclude";
    if (window.FilterState.isTagIncluded(kind, value)) return "include";

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

  function cycleTagState(kind, label) {
    const value = normalizeLabel(kind, label);
    const state = getTagState(kind, value);

    if (state === "none") {
      setInclude(kind, value);
    } else if (state === "include") {
      window.FilterState.setTagState(kind, value, "exclude");
    } else {
      window.FilterState.setTagState(kind, value, "none");
    }

    syncFilterControls();
    applyFiltersWithExclusions();
  }

  function refreshKnownTags() {
    if (Array.isArray(allVideos)) {
      allVideos.forEach(video => {
        if (video?.["カテゴリ"]) knownTags.category.add(String(video["カテゴリ"]).trim());
        if (video?._platform) knownTags.platform.add(String(video._platform).trim());
        (video?._types || []).forEach(tag => knownTags.format.add(tag));
        (video?._roles || []).forEach(tag => knownTags.role.add(tag));
        [
          ...(video?._collabLivers || []),
          ...(video?._collabUnits || [])
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
    const label = getRawButtonLabel(button);
    if (!label || button.closest("#activeTagChips")) return null;
    if (button.classList.contains("collab-member-toggle")) return null;

    const dataKind = normalizeFilterGroup(button.dataset.filterGroup);
    const dataValue = button.dataset.filterValue;
    if (dataKind && dataValue && filterGroups.includes(dataKind)) {
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

    document.querySelectorAll(tagSyncButtonSelector).forEach(button => {
      const info = findButtonInfo(button);
      const active = info ? isExcluded(info.kind, info.label) : false;
      button.classList.toggle(EXCLUDE_BUTTON_CLASS, active);
      syncExcludedButtonLabel(button, info, active);
      if (active) {
        button.setAttribute("aria-label", `${getDisplayLabel(info.kind, info.label)}を除外中`);
      }
    });

    if (typeof window.renderActiveTagChips === "function") window.renderActiveTagChips();
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

  function handleTagClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    if (!button.matches(tagSyncButtonSelector) || button.closest("#activeTagChips")) return;

    refreshKnownTags();
    const info = findButtonInfo(button);
    if (!info) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    cycleTagState(info.kind, info.label);
  }

  function handleResetClick(event) {
    const button = event.target.closest("#resetFilters, #modalResetBtn, #resetModalFilters");
    if (!button) return;

    window.FilterState.setState({ exclude: {} });
    requestSync();
  }

  function setup() {
    document.addEventListener("click", handleTagClick, true);
    document.addEventListener("click", handleResetClick, true);
    window.addEventListener("videoListRendered", requestSync);
    requestSync();
  }

  setup();
})();
