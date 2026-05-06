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
    sortButtonGroup.className = "flex gap-2";

    [
      ["desc", "新しい順 ↓"],
      ["asc", "古い順 ↑"]
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

  function configureDateButtons() {
    if (dateSelect) dateSelect.classList.add("hidden");
  }

  function syncModalValues() {
    if (searchField && searchInput) searchInput.value = searchField.value;
    if (sortSelect && sortOrder) sortOrder.value = sortSelect.value || "desc";

    if (categorySelect) selectedCategoryTag = categorySelect.value || "";
    if (roleSelect) selectedRoleTag = roleSelect.value || "";

    selectedVideoTypeTags.clear();
    if (typeSelect && typeSelect.value) {
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
    configureDateButtons();
    syncModalControls();
  });

  applyButton.addEventListener("click", () => {
    filtersBeforeApply = {
      date: selectedDateTag,
      collab: selectedCollabTag,
      platform: selectedPlatformTag,
      tag3D: selected3DTag,
      shorts: selectedShortsTag
    };
  }, true);

  applyButton.addEventListener("click", () => {
    configureSortButtons();
    configureDateButtons();
    syncModalValues();

    if (filtersBeforeApply) {
      selectedDateTag = filtersBeforeApply.date;
      selectedCollabTag = filtersBeforeApply.collab;
      selectedPlatformTag = filtersBeforeApply.platform;
      selected3DTag = filtersBeforeApply.tag3D;
      selectedShortsTag = filtersBeforeApply.shorts;
      filtersBeforeApply = null;
    }

    renderCategoryTags([...new Set(allVideos.map(v => v["カテゴリ"]).filter(Boolean))].sort());
    renderDateTags();
    renderPlatformTags();
    applyFilters();
  });
})();
