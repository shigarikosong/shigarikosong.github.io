(function () {
  const modal = document.getElementById("filterModal");
  const applyButton = document.getElementById("applyFilters");
  const sortSelect = document.getElementById("modalSortOrder");
  const searchField = document.getElementById("modalSearchInput");
  const categorySelect = document.getElementById("modalCategoryFilter");
  const dateSelect = document.getElementById("modalDateFilter");
  const typeSelect = document.getElementById("modalTypeFilter");
  const roleSelect = document.getElementById("modalRoleFilter");
  const formatTagsContainer = document.getElementById("modalFormatTags");
  const roleTagsContainer = document.getElementById("modalRoleTags");
  const collabLiverTagsContainer = document.getElementById("modalCollabLiverTags");
  const collabUnitTagsContainer = document.getElementById("modalCollabUnitTags");

  if (!modal || !applyButton) return;

  let filtersBeforeApply = null;
  let sortButtonGroup = null;

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

    return [...new Set(values)];
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
    });
  }

  function renderRoleTags() {
    if (!roleTagsContainer) return;

    roleTagsContainer.innerHTML = "";

    getSelectValues(roleSelect).forEach(role => {
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

  document.getElementById("openFilterModal")?.addEventListener("click", () => {
    configureSortButtons();
    configureCategoryButtons();
    configureDateButtons();
    configureFormatButtons();
    configureRoleButtons();
    configureResetButton();
    syncModalControls();
  });

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
  });
})();
