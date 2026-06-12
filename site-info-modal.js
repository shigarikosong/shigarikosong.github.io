(function () {
  const openButton = document.getElementById("openSiteInfoModal");
  const modal = document.getElementById("siteInfoModal");
  const panel = modal?.querySelector(".site-info-modal__panel");
  const manualPlayToggleButton = document.getElementById("manualPlayToggleButton");
  const closeButtons = [
    document.getElementById("closeSiteInfoModal"),
    document.getElementById("closeSiteInfoModalBottom")
  ].filter(Boolean);

  if (!openButton || !modal || !panel) return;

  let lastFocusedElement = null;
  let previousBodyOverflow = "";

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
    const filterModal = document.getElementById("filterModal");
    if (filterModal && !filterModal.classList.contains("hidden")) {
      filterModal.classList.add("hidden");
    }
  }

  function openModal() {
    closeFilterModalIfOpen();
    lastFocusedElement = document.activeElement;
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("site-info-modal-open");
    modal.classList.remove("hidden");
    updateManualPlayToggleButton();
    panel.focus();
  }

  function closeModal() {
    if (modal.classList.contains("hidden")) return;

    modal.classList.add("hidden");
    document.body.classList.remove("site-info-modal-open");
    document.body.style.overflow = previousBodyOverflow;

    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
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

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      closeModal();
    }
  });
})();
