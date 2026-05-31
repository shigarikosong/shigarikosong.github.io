(function () {
  const modal = document.getElementById("filterModal");
  const applyButton = document.getElementById("applyFilters");
  const sortSelect = document.getElementById("modalSortOrder");
  const searchField = document.getElementById("modalSearchInput");
  const categorySelect = document.getElementById("modalCategoryFilter");
  const dateSelect = document.getElementById("modalDateFilter");
  const typeSelect = document.getElementById("modalTypeFilter");
  const roleSelect = document.getElementById("modalRoleFilter");
  const categoryTagsContainer = document.getElementById("modalCategoryTags");
  const formatTagsContainer = document.getElementById("modalFormatTags");
  const roleTagsContainer = document.getElementById("modalRoleTags");
  const collabLiverTagsContainer = document.getElementById("modalCollabLiverTags");
  const collabUnitTagsContainer = document.getElementById("modalCollabUnitTags");
  const resultTotal = document.getElementById("modalResultTotal");
  const resultVisible = document.getElementById("modalResultVisible");
  const songCountElement = document.getElementById("songCount");

  if (!modal || !applyButton) return;

  const { categoryOrder, formatOrder, roleOrder } = window.TAG_CONFIG;

  let sortButtonGroup = null;
  let lockedScrollY = 0;
  let isWatchingSongCount = false;
  let shouldCorrectScrollAfterUnlock = false;

  function sortByPreferredOrder(values, preferredOrder) {
    return [...values].sort((a, b) => {
      const indexA = preferredOrder.indexOf(a);
      const indexB = preferredOrder.indexOf(b);

      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return String(a).localeCompare(String(b), "ja");
    });
  }

  function appendLineBreak(container) {
    const lineBreak = document.createElement("div");
    lineBreak.style.flexBasis = "100%";
    lineBreak.style.height = "0";
    container.appendChild(lineBreak);
  }

  function updateSortButtons() {
    if (!sortButtonGroup || !sortSelect) return;

    sortButtonGroup.querySelectorAll("button[data-sort]").forEach(button => {
      const isActive = button.dataset.sort === (sortSelect.value || "desc");
      button.className = getTagButtonClass("tag-sort", isActive, { size: "tag-modal-sort" });
    });
  }

  function updateModalResultCount() {
    if (!resultTotal || !resultVisible) return;

    const match = songCountElement?.textContent.match(/(\d+)\D+(\d+)/);

    if (match) {
      resultTotal.textContent = match[1];
      resultVisible.textContent = match[2];
      return;
    }

    resultTotal.textContent = String(allVideos.length || 0);
    resultVisible.textContent = String(currentFilteredVideos.length || 0);
  }

  function applyFiltersAndUpdateCount() {
    applyFilters();
    updateModalResultCount();

    if (document.body.dataset.filterScrollLocked === "true") {
      shouldCorrectScrollAfterUnlock = true;
    }
  }

  function watchSongCount() {
    if (!songCountElement || isWatchingSongCount) return;

    isWatchingSongCount = true;
    new MutationObserver(updateModalResultCount).observe(songCountElement, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  function configureSortButtons() {
    if (!sortSelect || sortButtonGroup) return;

    sortSelect.classList.add("hidden");

    sortButtonGroup = document.createElement("div");
    sortButtonGroup.className = "flex flex-wrap gap-2";

    [
      ["desc", "新しい順 ↓"],
      ["asc", "古い順 ↑"],
      ["title", "タイトル順"],
      ["artist", "アーティスト順"]
    ].forEach(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.sort = value;
      button.textContent = label;
      button.addEventListener("click", () => {
        sortSelect.value = value;
        if (sortOrder) sortOrder.value = value;
        updateSortButtons();
      });
      sortButtonGroup.appendChild(button);
    });

    sortSelect.insertAdjacentElement("afterend", sortButtonGroup);
    updateSortButtons();
  }

  function configureCategoryButtons() {
    if (categorySelect) categorySelect.classList.add("hidden");
  }

  function configureDateButtons() {
    if (dateSelect) dateSelect.classList.add("hidden");
  }

  function configureFormatButtons() {
    if (typeSelect) typeSelect.classList.add("hidden");
  }

  function configureRoleButtons() {
    if (roleSelect) roleSelect.classList.add("hidden");
  }

  function getSelectValues(select) {
    if (!select) return [];

    return [...select.options]
      .map(option => option.value)
      .filter(Boolean);
  }

  function getCsvTagValues(columnName) {
    const values = new Set();

    allVideos.forEach(video => {
      String(video[columnName] || "")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean)
        .forEach(value => values.add(value));
    });

    return sortCollabValues([...values]);
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

  function getFormatValues() {
    const values = getSelectValues(typeSelect);

    if (allVideos.some(video => video["3D"] === "TRUE")) values.push("3D");
    if (allVideos.some(video => video["Shorts"] === "TRUE")) values.push("Shorts");

    return sortByPreferredOrder([...new Set(values)], formatOrder);
  }

  function getFormatButtonClass(isActive) {
    return getTagButtonClass("tag-format", isActive, { size: "tag-sm" });
  }

  function handleMobileTagClick(group, value, renderUpdatedTags, clearSelect) {
    window.FilterState.toggleTag(group, value);
    if (typeof clearSelect === "function") clearSelect();
    if (typeof renderUpdatedTags === "function") renderUpdatedTags();
    applyFiltersAndUpdateCount();
    window.dispatchEvent(new CustomEvent("tagFilterStateChanged"));
  }

  function renderFormatTags() {
    if (!formatTagsContainer) return;

    formatTagsContainer.innerHTML = "";

    getFormatValues().forEach(format => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = format;
      button.dataset.filterGroup = "format";
      button.dataset.filterValue = format;

      const isActive = window.FilterState.isTagIncluded("format", format);

      button.className = getFormatButtonClass(isActive);
      button.addEventListener("click", () => {
        handleMobileTagClick("format", format, renderFormatTags, () => {
          if (typeSelect) typeSelect.value = "";
        });
      });

      formatTagsContainer.appendChild(button);

      if (format === "ライブ") appendLineBreak(formatTagsContainer);
    });
  }

  function reorderCategoryTags() {
    if (!categoryTagsContainer) return;

    const buttons = [...categoryTagsContainer.querySelectorAll("button")];
    const sortedButtons = [...buttons].sort((a, b) => {
      const indexA = categoryOrder.indexOf(a.textContent);
      const indexB = categoryOrder.indexOf(b.textContent);

      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return String(a.textContent).localeCompare(String(b.textContent), "ja");
    });

    const isAlreadySorted = buttons.every((button, index) => button === sortedButtons[index]);
    if (isAlreadySorted) return;

    sortedButtons.forEach(button => {
      categoryTagsContainer.appendChild(button);
    });
  }

  function observeCategoryTags() {
    if (!categoryTagsContainer || categoryTagsContainer.dataset.orderObserved) return;

    categoryTagsContainer.dataset.orderObserved = "true";
    new MutationObserver(reorderCategoryTags).observe(categoryTagsContainer, {
      childList: true
    });
  }

  function renderRoleTags() {
    if (!roleTagsContainer) return;

    roleTagsContainer.innerHTML = "";

    sortByPreferredOrder(getSelectValues(roleSelect), roleOrder).forEach(role => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = role;
      button.dataset.filterGroup = "role";
      button.dataset.filterValue = role;

      const isActive = window.FilterState.isTagIncluded("role", role);
      button.className = getTagButtonClass("tag-role-filter", isActive, { size: "tag-sm" });
      button.addEventListener("click", () => {
        handleMobileTagClick("role", role, renderRoleTags, () => {
          if (roleSelect) roleSelect.value = "";
        });
      });

      roleTagsContainer.appendChild(button);

      if (role === "ILLUSTRATION") appendLineBreak(roleTagsContainer);
    });
  }

  function getCollabButtonClass(isActive) {
    return getTagButtonClass("tag-collab-liver", isActive, { size: "tag-sm" });
  }

  function renderCollabTagGroup(container, values) {
    if (!container) return;

    container.innerHTML = "";

    values.forEach(value => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = value;
      button.dataset.filterGroup = "collab";
      button.dataset.filterValue = value;

      const isActive = window.FilterState.isTagIncluded("collab", value);
      button.className = getCollabButtonClass(isActive);
      button.addEventListener("click", () => {
        handleMobileTagClick("collab", value, renderCollabTags);
      });

      container.appendChild(button);
    });
  }

  function renderCollabTags() {
    renderCollabTagGroup(
      collabLiverTagsContainer,
      getCsvTagValues("コラボライバー")
    );
    renderCollabTagGroup(
      collabUnitTagsContainer,
      getCsvTagValues("コラボユニット")
    );
    sortRenderedCollabTags();
  }

  function renderMobileTagSections() {
    reorderCategoryTags();
    renderFormatTags();
    renderRoleTags();
    renderCollabTags();
  }

  function resetModalFilters() {
    if (searchField) searchField.value = "";
    if (searchInput) searchInput.value = "";
    if (sortSelect) sortSelect.value = "desc";
    if (sortOrder) sortOrder.value = "desc";
    if (categorySelect) categorySelect.value = "";
    if (dateSelect) dateSelect.value = "";
    if (typeSelect) typeSelect.value = "";
    if (roleSelect) roleSelect.value = "";

    window.FilterState.resetState();

    renderCategoryTags([...new Set(allVideos.map(v => v["カテゴリ"]).filter(Boolean))].sort());
    renderDateTags();
    renderPlatformTags();
    renderMobileTagSections();
    updateSortButtons();
    applyFiltersAndUpdateCount();
    window.dispatchEvent(new CustomEvent("tagFilterStateChanged"));
  }

  function configureResetButton() {
    if (document.getElementById("resetModalFilters")) return;

    const actions = applyButton.parentElement;
    if (!actions) return;

    const resetButton = document.createElement("button");
    resetButton.id = "resetModalFilters";
    resetButton.type = "button";
    resetButton.className = "bg-gray-100 text-gray-700 px-4 py-2 rounded-md";
    resetButton.textContent = "リセット";
    resetButton.addEventListener("click", resetModalFilters);

    applyButton.insertAdjacentElement("beforebegin", resetButton);
    actions.classList.remove("justify-between");
    actions.classList.add("justify-start", "gap-3", "items-center");
  }

  function syncModalValues() {
    if (searchField && searchInput) searchInput.value = searchField.value;
    if (sortSelect && sortOrder) sortOrder.value = sortSelect.value || "desc";
  }

  function syncModalControls() {
    if (searchField && searchInput) searchField.value = searchInput.value;
    if (sortSelect && sortOrder) sortSelect.value = sortOrder.value || "desc";
    if (categorySelect) categorySelect.value = window.FilterState.getState().include.category || "";
    if (roleSelect) roleSelect.value = "";
    if (typeSelect) typeSelect.value = "";
    updateSortButtons();
    renderMobileTagSections();
    updateModalResultCount();
  }

  function syncModalSearchInput() {
    syncModalValues();
    applyFiltersAndUpdateCount();
  }

  function lockPageScroll() {
    if (document.body.dataset.filterScrollLocked === "true") return;

    lockedScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.dataset.filterScrollLocked = "true";
    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
  }

  function unlockPageScroll() {
    if (document.body.dataset.filterScrollLocked !== "true") return;

    document.body.dataset.filterScrollLocked = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.overflow = "";
    window.scrollTo(0, lockedScrollY);

    if (shouldCorrectScrollAfterUnlock) {
      shouldCorrectScrollAfterUnlock = false;
      window.FilterScrollPosition?.requestScrollAfterFilterUpdate({
        behavior: "smooth",
        waitForSettledLayout: true
      });
    }
  }

  document.getElementById("openFilterModal")?.addEventListener("click", () => {
    lockPageScroll();
    configureSortButtons();
    configureCategoryButtons();
    configureDateButtons();
    configureFormatButtons();
    configureRoleButtons();
    configureResetButton();
    observeCategoryTags();
    watchSongCount();
    syncModalControls();
  });

  document.getElementById("closeFilterModal")?.addEventListener("click", unlockPageScroll);

  searchField?.addEventListener("input", syncModalSearchInput);

  applyButton.addEventListener("click", () => {
    configureSortButtons();
    configureCategoryButtons();
    configureDateButtons();
    configureFormatButtons();
    configureRoleButtons();
    configureResetButton();
    syncModalValues();

    renderCategoryTags([...new Set(allVideos.map(v => v["カテゴリ"]).filter(Boolean))].sort());
    renderDateTags();
    renderPlatformTags();
    renderMobileTagSections();
    applyFiltersAndUpdateCount();
    modal.classList.add("hidden");
    unlockPageScroll();
  });

  window.addEventListener("collabTagOrderReady", () => {
    renderCollabTags();
  });
  window.addEventListener("tagFilterStateChanged", () => {
    renderMobileTagSections();
    updateModalResultCount();
  });
})();
