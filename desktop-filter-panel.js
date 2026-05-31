(function () {
  const toggleButton = document.getElementById("desktopToggleFilters");
  const panel = document.getElementById("desktopFilterPanel");
  const sortSelect = document.getElementById("sortOrder");
  const sortButtons = document.getElementById("desktopSortButtons");
  const categoryTags = document.getElementById("desktopCategoryTags");
  const formatTags = document.getElementById("desktopFormatTags");
  const roleTags = document.getElementById("desktopRoleTags");
  const collabLiverTags = document.getElementById("desktopCollabLiverTags");
  const collabUnitTags = document.getElementById("desktopCollabUnitTags");

  if (!toggleButton || !panel) return;

  const sortLabels = {
    desc: "新しい順 ↓",
    asc: "古い順 ↑",
    title: "タイトル順",
    artist: "アーティスト順"
  };

  const { categoryOrder, formatOrder, roleOrder } = window.TAG_CONFIG;

  function sortByOrder(values, order) {
    return [...values].sort((a, b) => {
      const aIndex = order.indexOf(a);
      const bIndex = order.indexOf(b);
      if (aIndex !== -1 || bIndex !== -1) {
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      }
      return String(a).localeCompare(String(b), "ja");
    });
  }

  function buttonClass(isActive, kind) {
    const classes = {
      sort: "tag-sort",
      format: "tag-format",
      role: "tag-role-filter",
      collabLiver: "tag-collab-liver",
      collabUnit: "tag-collab-unit"
    };

    return getTagButtonClass(classes[kind] || "tag-collab-liver", isActive, { size: "tag-desktop" });
  }

  function createButton(label, isActive, kind, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = buttonClass(isActive, kind);
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function handleDesktopTagClick(group, value) {
    window.FilterState.toggleTag(group, value);
    applyFilters();
    window.dispatchEvent(new CustomEvent("tagFilterStateChanged"));
  }

  function appendWrap(container, index, breakAfterIndex) {
    if (index !== breakAfterIndex) return;

    const wrap = document.createElement("div");
    wrap.className = "basis-full h-0";
    container.appendChild(wrap);
  }

  function getSelectValues(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return [];

    return [...select.options]
      .map(option => option.value)
      .filter(value => value && value !== "all");
  }

  function getColumnValues(columnName) {
    const rows = Array.isArray(allVideos) ? allVideos : [];
    const values = new Set();

    rows.forEach(video => {
      String(video[columnName] || "")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean)
        .forEach(value => values.add(value));
    });

    return [...values];
  }

  function sortCollabValues(values) {
    if (window.isCollabTagOrderReady && typeof window.sortCollabTagValues === "function") {
      return window.sortCollabTagValues(values);
    }

    return [...values].sort((a, b) => String(a).localeCompare(String(b), "ja"));
  }

  function sortRenderedCollabTags() {
    if (window.isCollabTagOrderReady && typeof window.sortRenderedCollabTagContainers === "function") {
      window.sortRenderedCollabTagContainers();
    }
  }

  function renderSortButtons() {
    if (!sortSelect || !sortButtons) return;

    sortButtons.innerHTML = "";
    [...sortSelect.options].forEach(option => {
      const value = option.value;
      const isActive = (sortSelect.value || "desc") === value;

      sortButtons.appendChild(createButton(sortLabels[value] || option.textContent, isActive, "sort", () => {
        sortSelect.value = value;
        applyFilters();
        renderSortButtons();
      }));
    });
  }

  function reorderCategoryTags() {
    if (!categoryTags || !categoryTags.children.length) return;

    const buttons = [...categoryTags.children];
    const currentOrder = buttons.map(button => button.textContent.trim()).join(",");
    const sortedButtons = [...buttons].sort((a, b) => {
      const aIndex = categoryOrder.indexOf(a.textContent.trim());
      const bIndex = categoryOrder.indexOf(b.textContent.trim());
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

    const sortedOrder = sortedButtons.map(button => button.textContent.trim()).join(",");
    if (currentOrder === sortedOrder) return;

    sortedButtons.forEach(button => categoryTags.appendChild(button));
  }

  function renderFormatTags() {
    if (!formatTags) return;

    const typeValues = getSelectValues("modalTypeFilter");
    const values = sortByOrder([...new Set(["3D", "Shorts", ...typeValues])], formatOrder);

    formatTags.innerHTML = "";
    values.forEach((value, index) => {
      if (value === "3D") {
        const button = createButton(value, window.FilterState.isTagIncluded("format", value), "format", () => {
          handleDesktopTagClick("format", value);
        });

        button.dataset.filterGroup = "format";
        button.dataset.filterValue = value;

        formatTags.appendChild(button);
      } else if (value === "Shorts") {
        const button = createButton(value, window.FilterState.isTagIncluded("format", value), "format", () => {
          handleDesktopTagClick("format", value);
        });

        button.dataset.filterGroup = "format";
        button.dataset.filterValue = value;

        formatTags.appendChild(button);
      } else {
        const button = createButton(value, window.FilterState.isTagIncluded("format", value), "format", () => {
          handleDesktopTagClick("format", value);
        });

        button.dataset.filterGroup = "format";
        button.dataset.filterValue = value;

        formatTags.appendChild(button);
      }

      appendWrap(formatTags, index, 3);
    });
  }

  function renderRoleTags() {
    if (!roleTags) return;

    const values = sortByOrder(getSelectValues("modalRoleFilter"), roleOrder);
    roleTags.innerHTML = "";

    values.forEach((value, index) => {
      const button = createButton(value, window.FilterState.isTagIncluded("role", value), "role", () => {
        handleDesktopTagClick("role", value);
      });

      button.dataset.filterGroup = "role";
      button.dataset.filterValue = value;

      roleTags.appendChild(button);

      appendWrap(roleTags, index, 4);
    });
  }

  function renderCollabGroup(container, values, kind) {
    if (!container) return;

    container.innerHTML = "";
    sortCollabValues(values).forEach(value => {
      const button = createButton(value, window.FilterState.isTagIncluded("collab", value), kind, () => {
        handleDesktopTagClick("collab", value);
      });

      button.dataset.filterGroup = "collab";
      button.dataset.filterValue = value;

      container.appendChild(button);
    });
  }

  function renderCollabTags() {
    renderCollabGroup(collabLiverTags, getColumnValues("コラボライバー"), "collabLiver");
    renderCollabGroup(collabUnitTags, getColumnValues("コラボユニット"), "collabUnit");
    sortRenderedCollabTags();
  }

  function renderDesktopPanel() {
    renderSortButtons();
    reorderCategoryTags();
    renderFormatTags();
    renderRoleTags();
    renderCollabTags();
  }

  function syncPanelState(isOpen) {
    toggleButton.setAttribute("aria-expanded", String(isOpen));
    toggleButton.textContent = isOpen ? "閉じる" : "絞り込み";
    document.body.classList.toggle("desktop-filter-open", isOpen);

    requestAnimationFrame(() => {
      if (typeof updateActiveTagChipsPosition === "function") updateActiveTagChipsPosition();
    });
  }

  function requestCloseTargetJumpAfterClose() {
    const scrollToCloseTarget = () => {
      window.ScrollUtils?.scrollToPlayingOrResultCountOrListTop({ behavior: "auto" });
    };
    const jumpToListTopIfNoPlaying = () => {
      if (document.querySelector("#videoList .playing")) return;

      const videoList = document.getElementById("videoList");
      if (!videoList) return;

      const topOffset = window.ScrollUtils?.getStickyTopOffset?.() || 0;
      const targetY = window.scrollY + videoList.getBoundingClientRect().top - topOffset;
      const nextTop = Math.max(0, Math.round(targetY));
      window.scrollTo(0, nextTop);
      document.documentElement.scrollTop = nextTop;
      document.body.scrollTop = nextTop;
    };

    scrollToCloseTarget();
    requestAnimationFrame(scrollToCloseTarget);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrollToCloseTarget();
      jumpToListTopIfNoPlaying();
    }));
    window.setTimeout(() => {
      scrollToCloseTarget();
      jumpToListTopIfNoPlaying();
    }, 120);
    window.setTimeout(() => {
      scrollToCloseTarget();
      jumpToListTopIfNoPlaying();
    }, 320);
  }

  function openPanel() {
    panel.classList.remove("hidden");
    renderDesktopPanel();
    syncPanelState(true);
  }

  function closePanel(options = {}) {
    const { scrollToResults = false } = options;
    panel.classList.add("hidden");
    syncPanelState(false);
    if (scrollToResults) requestCloseTargetJumpAfterClose();
  }

  function togglePanel() {
    if (panel.classList.contains("hidden")) {
      openPanel();
    } else {
      closePanel({ scrollToResults: true });
    }
  }

  toggleButton.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePanel();
  });

  document.addEventListener("click", (event) => {
    if (panel.classList.contains("hidden")) return;
    const path = event.composedPath();
    if (path.includes(panel) || path.includes(toggleButton)) return;

    closePanel();
  });

  if (categoryTags) {
    const observer = new MutationObserver(reorderCategoryTags);
    observer.observe(categoryTags, { childList: true });
  }

  const songCount = document.getElementById("songCount");
  if (songCount) {
    const observer = new MutationObserver(() => {
      if (!panel.classList.contains("hidden")) renderDesktopPanel();
    });
    observer.observe(songCount, { childList: true, characterData: true, subtree: true });
  }

  window.addEventListener("collabTagOrderReady", () => {
    renderCollabTags();
  });
  window.addEventListener("tagFilterStateChanged", renderDesktopPanel);
})();
