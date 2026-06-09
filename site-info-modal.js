(function () {
  const openButton = document.getElementById("openSiteInfoModal");
  const modal = document.getElementById("siteInfoModal");
  const panel = modal?.querySelector(".site-info-modal__panel");
  const closeButtons = [
    document.getElementById("closeSiteInfoModal"),
    document.getElementById("closeSiteInfoModalBottom")
  ].filter(Boolean);

  if (!openButton || !modal || !panel) return;

  let lastFocusedElement = null;
  let previousBodyOverflow = "";

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

  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      closeModal();
    }
  });
})();
