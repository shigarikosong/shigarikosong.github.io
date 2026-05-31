(() => {
  // Keeps exclude-state styling in sync after the actual filter owners update FilterState.
  const EXCLUDE_BUTTON_CLASS = "exclusion-style-active";
  const EXCLUDE_CHIP_CLASS = "exclusion-style-chip";
  const { dateLabelToValue } = window.TAG_CONFIG;
  const dateValueToLabel = Object.fromEntries(
    Object.entries(dateLabelToValue).map(([label, value]) => [value, label])
  );
  const filterGroups = ["category", "platform", "date", "format", "role", "collab", "flag"];
  const filterControlIds = [
    "modalCategoryTags",
    "desktopCategoryTags",
    "modalPlatformTags",
    "desktopPlatformTags",
    "modalDateTags",
    "desktopDateTags",
    "modalFormatTags",
    "desktopFormatTags",
    "modalRoleTags",
    "desktopRoleTags",
    "modalCollabLiverTags",
    "desktopCollabLiverTags",
    "modalCollabUnitTags",
    "desktopCollabUnitTags"
  ];
  const filterControlRootSelector = filterControlIds.map(id => `#${id}`).join(",");
  const filterDataButtonSelector = "button[data-filter-group][data-filter-value]";
  const filterControlButtonSelector = filterControlIds
    .map(id => `#${id} ${filterDataButtonSelector}`)
    .join(",");
  const tagSyncButtonSelector = [
    filterControlButtonSelector,
    `#videoList ${filterDataButtonSelector}`
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

  function isExcluded(kind, label) {
    return window.FilterState.isTagExcluded(kind, label);
  }

  function getSyncButtons(root = document) {
    if (!root || root === document) {
      return [...document.querySelectorAll(tagSyncButtonSelector)];
    }

    if (root.matches?.(filterControlRootSelector)) {
      return [...root.querySelectorAll(filterDataButtonSelector)];
    }

    if (root.matches?.("#videoList")) {
      return [...root.querySelectorAll(filterDataButtonSelector)];
    }

    const buttons = [];
    if (root.matches?.(tagSyncButtonSelector)) buttons.push(root);
    root.querySelectorAll?.(tagSyncButtonSelector).forEach(button => buttons.push(button));
    return buttons;
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

    return null;
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

  function syncExcludeButton(button) {
    const info = findButtonInfo(button);
    const active = info ? isExcluded(info.kind, info.label) : false;
    button.classList.toggle(EXCLUDE_BUTTON_CLASS, active);
    syncExcludedButtonLabel(button, info, active);
    if (active) {
      button.setAttribute("aria-label", `${getDisplayLabel(info.kind, info.label)}を除外中`);
    }
  }

  function syncExcludeButtonStyles(roots = [document]) {
    roots.forEach(root => {
      getSyncButtons(root).forEach(syncExcludeButton);
    });
  }

  function requestSync() {
    if (syncFrame !== null) return;

    syncFrame = requestAnimationFrame(() => {
      syncFrame = null;
      syncExcludeButtonStyles();
    });
  }

  function handleResetClick(event) {
    const button = event.target.closest("#resetFilters, #modalResetBtn, #resetModalFilters");
    if (!button) return;

    window.FilterState.setState({ exclude: {} });
    requestSync();
  }

  function setup() {
    document.addEventListener("click", handleResetClick, true);
    window.addEventListener("videoListRendered", requestSync);
    window.addEventListener("tagFilterStateChanged", requestSync);
    requestSync();
  }

  setup();
})();
