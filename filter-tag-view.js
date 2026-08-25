(() => {
  const EXCLUDE_BUTTON_CLASS = "exclusion-style-active";
  const ACTIVE_CLASS_BY_BASE_CLASS = Object.freeze({
    "tag-style": "tag-style-active",
    "tag-platform": "tag-platform-active",
    "tag-time": "tag-time-active",
    "tag-format": "tag-format-active",
    "tag-role-filter": "tag-role-filter-active",
    "tag-collab-liver": "tag-collab-liver-active",
    "tag-collab-unit": "tag-collab-unit-active"
  });
  const ACTIVE_CLASS_PAIRS = Object.freeze(Object.entries(ACTIVE_CLASS_BY_BASE_CLASS));

  function normalizeGroup(group) {
    return group === "time" ? "date" : group;
  }

  function getPresentation(group, value, label = "") {
    const normalizedGroup = normalizeGroup(group);
    const normalizedValue = window.FilterState.normalizeValue(normalizedGroup, value);
    const displayLabel = String(
      label || window.FilterState.getDisplayLabel(normalizedGroup, normalizedValue) || normalizedValue
    ).trim();
    const state = window.FilterState.isTagExcluded(normalizedGroup, normalizedValue)
      ? "exclude"
      : window.FilterState.isTagIncluded(normalizedGroup, normalizedValue)
        ? "include"
        : "none";

    return Object.freeze({
      group: normalizedGroup,
      value: normalizedValue,
      label: displayLabel,
      state,
      text: state === "exclude" ? `- ${displayLabel}` : displayLabel,
      ariaLabel: state === "exclude" ? `${displayLabel}を除外中` : ""
    });
  }

  function getActiveClass(button) {
    for (const [baseClass, activeClass] of ACTIVE_CLASS_PAIRS) {
      if (button.classList.contains(baseClass)) return activeClass;
    }
    return "";
  }

  function applyButton(button, presentation) {
    if (!button || !presentation) return;

    const activeClass = getActiveClass(button);

    button.dataset.filterGroup = presentation.group;
    button.dataset.filterValue = presentation.value;
    button.textContent = presentation.text;
    if (activeClass) {
      button.classList.toggle(activeClass, presentation.state === "include");
    }
    button.classList.toggle(EXCLUDE_BUTTON_CLASS, presentation.state === "exclude");

    if (presentation.ariaLabel) {
      button.setAttribute("aria-label", presentation.ariaLabel);
      button.dataset.filterTagViewAria = "true";
    } else if (button.dataset.filterTagViewAria === "true") {
      button.removeAttribute("aria-label");
      delete button.dataset.filterTagViewAria;
    }
  }

  window.FilterTagView = Object.freeze({
    applyButton,
    getPresentation
  });
})();
