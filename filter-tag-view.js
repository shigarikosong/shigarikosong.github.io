(() => {
  const EXCLUDE_BUTTON_CLASS = "exclusion-style-active";

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

  function applyButton(button, presentation) {
    if (!button || !presentation) return;

    button.dataset.filterGroup = presentation.group;
    button.dataset.filterValue = presentation.value;
    button.textContent = presentation.text;
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
