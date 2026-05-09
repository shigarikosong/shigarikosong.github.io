(() => {
  const TIME_CHIP_CLASS = "time-active-chip";
  const dateLabels = ["最近", "1年以内", "1年以上前"];
  let selectedTimeLabel = "";
  let syncFrame = null;

  function getRawLabel(button) {
    return String(button?.dataset?.tagExclusionLabel || button?.textContent || "")
      .replace(/^[-−]\s*/, "")
      .trim();
  }

  function isTimeButton(button) {
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
    const sourceButton = getTimeButtons().find(button => getRawLabel(button) === selectedTimeLabel);
    if (sourceButton) {
      sourceButton.click();
    } else {
      selectedTimeLabel = "";
      requestSync();
    }
  }

  function syncTimeButtons() {
    getTimeButtons().forEach(button => {
      setIncludedStyle(button, getRawLabel(button) === selectedTimeLabel);
    });
  }

  function renderTimeChip() {
    const activeTagChips = document.getElementById("activeTagChips");
    const activeTagChipsInner = document.getElementById("activeTagChipsInner");
    if (!activeTagChips || !activeTagChipsInner) return;

    activeTagChipsInner
      .querySelectorAll(`.${TIME_CHIP_CLASS}`)
      .forEach(chip => chip.remove());

    if (!selectedTimeLabel) return;

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `${TIME_CHIP_CLASS} shrink-0 border border-green-300 text-green-700 bg-green-50 px-2.5 py-1 rounded-full text-xs hover:bg-green-100 transition`;
    chip.textContent = selectedTimeLabel;
    chip.setAttribute("aria-label", `${selectedTimeLabel}の絞り込みを解除`);
    chip.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      clearSelectedTime();
    });

    activeTagChipsInner.appendChild(chip);
    activeTagChips.classList.remove("hidden");
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
      event.stopPropagation();
      clearSelectedTime();
      return;
    }

    if (button.closest("#resetFilters, #modalResetBtn")) {
      selectedTimeLabel = "";
      setTimeout(requestSync, 0);
      return;
    }

    if (!isTimeButton(button)) return;

    const label = getRawLabel(button);
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
