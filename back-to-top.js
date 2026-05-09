(function () {
  const SHOW_SCROLL_Y = 420;
  const button = document.createElement("button");

  button.type = "button";
  button.id = "backToTopButton";
  button.className = "back-to-top-button";
  button.setAttribute("aria-label", "ページトップへ戻る");
  button.textContent = "↑";

  document.body.appendChild(button);

  function isPlayerVisible() {
    const fixedPlayer = document.getElementById("fixedPlayer");
    return fixedPlayer && getComputedStyle(fixedPlayer).display !== "none";
  }

  function updateButtonState() {
    const shouldShow = window.scrollY > SHOW_SCROLL_Y;
    button.classList.toggle("is-visible", shouldShow);
    button.classList.toggle("is-player-visible", isPlayerVisible());
  }

  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", updateButtonState, { passive: true });
  window.addEventListener("resize", updateButtonState);
  window.visualViewport?.addEventListener("resize", updateButtonState);

  const fixedPlayer = document.getElementById("fixedPlayer");
  if (fixedPlayer) {
    const observer = new MutationObserver(updateButtonState);
    observer.observe(fixedPlayer, { attributes: true, attributeFilter: ["style", "class"] });
  }

  updateButtonState();
})();
