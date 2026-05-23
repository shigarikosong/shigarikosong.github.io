(() => {
  const TIME_CHIP_CLASS = "time-active-chip";
  const dateLabels = ["最近", "1年以内", "1年以上前"];
  const dateValueToLabel = {
    recent: "最近",
    year: "1年以内",
    old: "1年以上前"
  };
  let selectedTimeLabel = "";
  let syncFrame = null;

  function getRawLabel(button) {
    return String(button?.dataset?.tagExclusionLabel || button?.textContent || "")
      .replace(/^[-−]\s*/, "")
      .trim();
  }

  function getTimeValue(button) {
    if (button?.dataset?.filterGroup === "time" && button.dataset.filterValue) {
      return button.dataset.filterValue;
    }

    return getRawLabel(button);
  }

  function getDisplayLabel(value) {
    return dateValueToLabel[value] || value;
  }

  function isTimeButton(button) {
    if (button?.dataset?.filterGroup === "time") return true;
    return button?.closest?.("#modalDateTags, #desktopDateTags") && dateLabels.includes(getRawLabel(button));
  }

  function getTimeButtons() {
    return [...document.querySelectorAll("#modalDateTags button, #desktopDateTags button")]
      .filter(isTimeButton);
  }

  function setIncludedStyle(button, active) {
    if (button.classList.contains("tag-exclusion-active")) return;

    button.classList.toggle("bg-green-600", active);
    button.classList.toggle("text-white", active);
    button.classList.toggle("bg-green-100", !active);
    button.classList.toggle("text-green-700", !active);
  }

  function clearSelectedTime() {
    const sourceButton = getTimeButtons().find(button => getTimeValue(button) === selectedTimeLabel);
    selectedTimeLabel = "";

    if (sourceButton && typeof sourceButton.onclick === "function") {
      sourceButton.onclick.call(sourceButton, new MouseEvent("click", { bubbles: false }));
    } else {
      requestSync();
    }
  }

  function syncTimeButtons() {
    // Time button active state is handled by renderDateTags() in script.js.
  }

  function renderTimeChip() {
    const activeTagChipsInner = document.getElementById("activeTagChipsInner");
    if (!activeTagChipsInner) return;

    activeTagChipsInner
      .querySelectorAll(`.${TIME_CHIP_CLASS}`)
      .forEach(chip => chip.remove());
  }

  function sync() {
    syncFrame = null;
    syncTimeButtons();
    renderTimeChip();
  }

  function requestSync() {
    if (syncFrame !== null) return;
    syncFrame = requestAnimationFrame(sync);
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.classList.contains(TIME_CHIP_CLASS)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearSelectedTime();
      return;
    }

    if (button.closest("#resetFilters, #modalResetBtn, #resetModalFilters")) {
      selectedTimeLabel = "";
      setTimeout(requestSync, 0);
      return;
    }

    if (!isTimeButton(button)) return;

    const label = getTimeValue(button);
    if (button.classList.contains("tag-exclusion-active")) {
      selectedTimeLabel = "";
    } else {
      selectedTimeLabel = selectedTimeLabel === label ? "" : label;
    }

    setTimeout(requestSync, 0);
  }, true);

  const observer = new MutationObserver(requestSync);
  observer.observe(document.body, { childList: true, subtree: true });
  requestSync();
})();
