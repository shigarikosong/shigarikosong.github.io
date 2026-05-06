(function () {
  const modal = document.getElementById("filterModal");
  const applyButton = document.getElementById("applyFilters");
  const sortSelect = document.getElementById("modalSortOrder");
  const searchField = document.getElementById("modalSearchInput");
  const categorySelect = document.getElementById("modalCategoryFilter");
  const dateSelect = document.getElementById("modalDateFilter");
  const typeSelect = document.getElementById("modalTypeFilter");
  const roleSelect = document.getElementById("modalRoleFilter");

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

    if (roleSelect && roleSelect.value) selectedRoleTag = roleSelect.value;
    if (typeSelect && typeSelect.value) {
      selectedVideoTypeTags.clear();
      selectedVideoTypeTags.add(typeSelect.value);
    }
  }

  function syncModalControls() {
    if (searchField && searchInput) searchField.value = searchInput.value;
    if (sortSelect && sortOrder) sortSelect.value = sortOrder.value || "desc";
    if (categorySelect) categorySelect.value = selectedCategoryTag || "";
    if (roleSelect) roleSelect.value = selectedRoleTag || "";
    if (typeSelect) typeSelect.value = [...selectedVideoTypeTags][0] || "";
    updateSortButtons();
  }

  document.getElementById("openFilterModal")?.addEventListener("click", () => {
    configureSortButtons();
    configureCategoryButtons();
    configureDateButtons();
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
    configureResetButton();
    syncModalValues();

    if (filtersBeforeApply) {
      selectedCategoryTag = filtersBeforeApply.category;
      selectedDateTag = filtersBeforeApply.date;
      selectedCollabTag = filtersBeforeApply.collab;
      if (!roleSelect || !roleSelect.value) selectedRoleTag = filtersBeforeApply.role;
      selectedPlatformTag = filtersBeforeApply.platform;
      selected3DTag = filtersBeforeApply.tag3D;
      selectedShortsTag = filtersBeforeApply.shorts;
      if (!typeSelect || !typeSelect.value) {
        selectedVideoTypeTags.clear();
        filtersBeforeApply.videoTypes.forEach(tag => selectedVideoTypeTags.add(tag));
      }
      filtersBeforeApply = null;
    }

    renderCategoryTags([...new Set(allVideos.map(v => v["カテゴリ"]).filter(Boolean))].sort());
    renderDateTags();
    renderPlatformTags();
    applyFilters();
  });
})();
