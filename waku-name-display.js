(function () {
  const originalRenderVideoList = window.renderVideoList;

  if (typeof originalRenderVideoList !== "function") return;

  function addWakuNames(videos) {
    const items = document.querySelectorAll("#videoList > div");

    items.forEach((item, index) => {
      const wakuName = String(videos?.[index]?.waku_name || "").trim();
      if (!wakuName) return;

      const metaRow = item.querySelector(".video-meta");
      if (!metaRow || metaRow.querySelector(".video-meta-waku")) return;

      const wakuSpan = document.createElement("span");
      wakuSpan.className = "video-meta-waku";
      wakuSpan.textContent = wakuName;
      metaRow.appendChild(wakuSpan);
    });
  }

  window.renderVideoList = function renderVideoListWithWakuName(videos) {
    originalRenderVideoList(videos);
    addWakuNames(videos);
  };
})();
