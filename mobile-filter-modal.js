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

  function configureDateOptions() {
    if (!dateSelect || dateSelect.dataset.mobileOptionsReady === "1") return;

    dateSelect.innerHTML = "";
    [
      ["", "公開時期"],
      ["recent", "最近"],
      ["year", "1年以内"],
      ["old", "1年以上前"]
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      dateSelect.appendChild(option);
    });

    dateSelect.dataset.mobileOptionsReady = "1";
  }

  function syncModalValues() {
    if (searchField && searchInput) searchInput.value = searchField.value;
    if (sortSelect && sortOrder) sortOrder.value = sortSelect.value;

    if (categorySelect) selectedCategoryTag = categorySelect.value || "";
    if (dateSelect) selectedDateTag = dateSelect.value || "";
    if (roleSelect) selectedRoleTag = roleSelect.value || "";

    selectedVideoTypeTags.clear();
    if (typeSelect && typeSelect.value) {
      selectedVideoTypeTags.add(typeSelect.value);
    }
  }

  function syncModalControls() {
    if (searchField && searchInput) searchField.value = searchInput.value;
    if (sortSelect && sortOrder) sortSelect.value = sortOrder.value;
    if (categorySelect) categorySelect.value = selectedCategoryTag || "";
    if (dateSelect) dateSelect.value = selectedDateTag || "";
    if (roleSelect) roleSelect.value = selectedRoleTag || "";
    if (typeSelect) typeSelect.value = [...selectedVideoTypeTags][0] || "";
  }

  document.getElementById("openFilterModal")?.addEventListener("click", () => {
    configureDateOptions();
    syncModalControls();
  });

  applyButton.addEventListener("click", () => {
    filtersBeforeApply = {
      collab: selectedCollabTag,
      platform: selectedPlatformTag,
      tag3D: selected3DTag,
      shorts: selectedShortsTag
    };
  }, true);

  applyButton.addEventListener("click", () => {
    configureDateOptions();
    syncModalValues();

    if (filtersBeforeApply) {
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
