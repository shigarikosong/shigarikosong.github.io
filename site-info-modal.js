(function () {
  const openButton = document.getElementById("openSiteInfoModal");
  const modal = document.getElementById("siteInfoModal");
  const panel = modal?.querySelector(".site-info-modal__panel");
  const manualPlayToggleButton = document.getElementById("manualPlayToggleButton");
  const numberInspectionTrigger = document.getElementById("numberInspectionTrigger");
  const numberInspectionControls = document.getElementById("numberInspectionControls");
  const exitNumberInspection = document.getElementById("exitNumberInspection");
  const closeButtons = [
    document.getElementById("closeSiteInfoModal"),
    document.getElementById("closeSiteInfoModalBottom")
  ].filter(Boolean);

  if (!openButton || !modal || !panel) return;

  let lastFocusedElement = null;
  let previousBodyOverflow = "";
  let numberInspectionClicks = 0;
  let lastNumberInspectionClick = 0;

  function updateNumberInspectionControls() {
    if (!numberInspectionControls) return;
    const enabled = window.NumberInspection.isEnabled();
    const exitWasFocused = document.activeElement === exitNumberInspection;
    numberInspectionControls.hidden = !enabled;
    if (!enabled && exitWasFocused) window.FocusUtils.focus(numberInspectionTrigger);
  }

  numberInspectionTrigger?.addEventListener("click", () => {
    if (!modal.open || window.NumberInspection.isEnabled()) return;
    const now = Date.now();
    if (now - lastNumberInspectionClick > 2000) numberInspectionClicks = 0;
    lastNumberInspectionClick = now;
    if (++numberInspectionClicks < 5) return;
    numberInspectionClicks = 0;
    window.NumberInspection.setEnabled(true);
  });
  exitNumberInspection?.addEventListener("click", () => {
    numberInspectionClicks = 0;
    window.NumberInspection.setEnabled(false);
  });
  window.addEventListener("numberInspectionModeChange", updateNumberInspectionControls);

  function isManualPlayEnabled() {
    return Boolean(window.isManualPlayTestModeEnabled?.());
  }

  function updateManualPlayToggleButton() {
    if (!manualPlayToggleButton) return;

    const enabled = isManualPlayEnabled();
    manualPlayToggleButton.textContent = enabled
      ? "手動再生モードをOFFにする"
      : "手動再生モードをONにする";
    manualPlayToggleButton.setAttribute("aria-pressed", String(enabled));
  }

  function closeFilterModalIfOpen() {
    window.MobileFilterModal?.close({ scrollToResults: false });
  }

  function openModal() {
    if (modal.open) return;
    numberInspectionClicks = 0;
    closeFilterModalIfOpen();
    lastFocusedElement = document.activeElement;
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("site-info-modal-open");
    modal.classList.remove("hidden");
    updateManualPlayToggleButton();
    updateNumberInspectionControls();
    modal.showModal();
    window.FocusUtils.focus(panel);
  }

  function closeModal() {
    if (modal.classList.contains("hidden")) return;
    numberInspectionClicks = 0;

    modal.classList.add("hidden");
    modal.close();
    document.body.classList.remove("site-info-modal-open");
    document.body.style.overflow = previousBodyOverflow;

    if (!window.FocusUtils.focus(lastFocusedElement)) window.FocusUtils.focus(openButton);
    lastFocusedElement = null;
  }

  openButton.addEventListener("click", openModal);

  closeButtons.forEach(button => {
    button.addEventListener("click", closeModal);
  });

  manualPlayToggleButton?.addEventListener("click", () => {
    const enabled = !isManualPlayEnabled();
    window.setManualPlayTestModeEnabled?.(enabled);
    window.showManualPlayTestModeNotice?.(enabled);
    updateManualPlayToggleButton();
  });

  window.addEventListener("manualPlayTestModeChange", updateManualPlayToggleButton);
  updateManualPlayToggleButton();

  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  modal.addEventListener("cancel", event => {
    event.preventDefault();
    closeModal();
  });
  modal.addEventListener("close", () => {
    if (!modal.open) closeModal();
  });
  modal.addEventListener("keydown", event => window.FocusUtils.containTab(event, modal));
})();
