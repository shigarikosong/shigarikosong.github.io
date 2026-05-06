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

  if (!modal || !applyButton) return;

  const categoryOrder = ["ソロ", "コラボ", "あやかき"];
  const formatOrder = ["3D", "Shorts", "歌枠", "ライブ", "Full", "ハイライト", "アカペラ", "企画", "比較"];
  const roleOrder = ["VOCAL", "DANCE", "CHORUS", "MOVIE", "ILLUSTRATION", "PIANO", "EUPHONIUM", "KALIMBA"];

  let filtersBeforeApply = null;
  let sortButtonGroup = null;
  let lockedScrollY = 0;

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
      button.className = isActive
        ? "bg-blue-600 text-white px-3 py-2 rounded-md text-sm"
        : "bg-blue-100 text-blue-700 px-3 py-2 rounded-md text-sm";
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

    return [...values].sort((a, b) => a.localeCompare(b, "ja"));
  }

  function getFormatValues() {
    const values = getSelectValues(typeSelect);

    if (allVideos.some(video => video["3D"] === "TRUE")) values.push("3D");
    if (allVideos.some(video => video["Shorts"] === "TRUE")) values.push("Shorts");

    return sortByPreferredOrder([...new Set(values)], formatOrder);
  }

  function getFormatButtonClass(isActive) {
    return isActive
      ? "bg-pink-600 text-white px-3 py-1 rounded-full text-xs"
      : "bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-xs";
  }

  function renderFormatTags() {
    if (!formatTagsContainer) return;

    formatTagsContainer.innerHTML = "";

    getFormatValues().forEach(format => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = format;

      const is3D = format === "3D";
      const isShorts = format === "Shorts";
      const isActive = is3D
        ? selected3DTag === "include"
        : isShorts
          ? selectedShortsTag === "include"
          : selectedVideoTypeTags.has(format);

      button.className = getFormatButtonClass(isActive);
      button.addEventListener("click", () => {
        if (is3D) {
          selected3DTag = selected3DTag === "include" ? null : "include";
        } else if (isShorts) {
          selectedShortsTag = selectedShortsTag === "include" ? null : "include";
        } else {
          toggleVideoTypeTag(format);
        }

        if (typeSelect) typeSelect.value = "";
        renderFormatTags();
        applyFilters();
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

      const isActive = selectedRoleTag === role;
      button.className = isActive
        ? "bg-amber-600 text-white px-3 py-1 rounded-full text-xs"
        : "bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs";
      button.addEventListener("click", () => {
        selectedRoleTag = selectedRoleTag === role ? "" : role;

        if (roleSelect) roleSelect.value = "";
        renderRoleTags();
        applyFilters();
      });

      roleTagsContainer.appendChild(button);

      if (role === "ILLUSTRATION") appendLineBreak(roleTagsContainer);
    });
  }

  function getCollabButtonClass(isActive) {
    return isActive
      ? "bg-gray-700 text-white px-3 py-1 rounded-full text-xs"
      : "bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs";
  }

  function renderCollabTagGroup(container, values) {
    if (!container) return;

    container.innerHTML = "";

    values.forEach(value => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = value;

      const isActive = selectedCollabTag === value;
      button.className = getCollabButtonClass(isActive);
      button.addEventListener("click", () => {
        selectedCollabTag = selectedCollabTag === value ? "" : value;
        renderCollabTags();
        applyFilters();
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

    selectedCategoryTag = "";
    selectedCollabTag = "";
    selectedRoleTag = "";
    selectedPlatformTag = "";
    selectedDateTag = "";
    selected3DTag = null;
    selectedShortsTag = null;
    selectedVideoTypeTags.clear();

    renderCategoryTags([...new Set(allVideos.map(v => v["カテゴリ"]).filter(Boolean))].sort());
    renderDateTags();
    renderPlatformTags();
    renderMobileTagSections();
    updateSortButtons();
    applyFilters();
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

    applyButton.insertAdjacentElement("afterend", resetButton);
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
    if (categorySelect) categorySelect.value = selectedCategoryTag || "";
    if (roleSelect) roleSelect.value = "";
    if (typeSelect) typeSelect.value = "";
    updateSortButtons();
    renderMobileTagSections();
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
    syncModalControls();
  });

  document.getElementById("closeFilterModal")?.addEventListener("click", unlockPageScroll);

  applyButton.addEventListener("click", () => {
    filtersBeforeApply = {
      category: selectedCategoryTag,
      date: selectedDateTag,
      collab: selectedCollabTag,
      role: selectedRoleTag,
      platform: selectedPlatformTag,
      tag3D: selected3DTag,
      shorts: selectedShortsTag,
      videoTypes: new Set(selectedVideoTypeTags)
    };
  }, true);

  applyButton.addEventListener("click", () => {
    configureSortButtons();
    configureCategoryButtons();
    configureDateButtons();
    configureFormatButtons();
    configureRoleButtons();
    configureResetButton();
    syncModalValues();

    if (filtersBeforeApply) {
      selectedCategoryTag = filtersBeforeApply.category;
      selectedDateTag = filtersBeforeApply.date;
      selectedCollabTag = filtersBeforeApply.collab;
      selectedRoleTag = filtersBeforeApply.role;
      selectedPlatformTag = filtersBeforeApply.platform;
      selected3DTag = filtersBeforeApply.tag3D;
      selectedShortsTag = filtersBeforeApply.shorts;
      selectedVideoTypeTags.clear();
      filtersBeforeApply.videoTypes.forEach(tag => selectedVideoTypeTags.add(tag));
      filtersBeforeApply = null;
    }

    renderCategoryTags([...new Set(allVideos.map(v => v["カテゴリ"]).filter(Boolean))].sort());
    renderDateTags();
    renderPlatformTags();
    renderMobileTagSections();
    applyFilters();
    unlockPageScroll();
  });
})();
