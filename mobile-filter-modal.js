(function () {
  const modal = document.getElementById("filterModal");
  const openButton = document.getElementById("openFilterModal");
  const panel = document.getElementById("filterModalPanel");
  const applyButton = document.getElementById("applyFilters");
  const sortSelect = document.getElementById("modalSortOrder");
  const mobileSearchInput = document.getElementById("mobileSearchInput");
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

  if (!modal || !applyButton) return;

  const { categoryOrder, formatOrder, roleOrder } = window.TAG_CONFIG;

  let sortButtonGroup = null;
  let lockedScrollY = 0;
  let shouldCorrectScrollAfterUnlock = false;
  let hasUnappliedModalChanges = false;
  let scheduledApplyFrame = null;
  let scheduledApplyAfterPaintFrame = null;
  let shouldDispatchStateChangeAfterApply = false;

  function cancelScheduledFilterApply() {
    if (scheduledApplyFrame !== null) {
      cancelAnimationFrame(scheduledApplyFrame);
      scheduledApplyFrame = null;
    }

    if (scheduledApplyAfterPaintFrame !== null) {
      cancelAnimationFrame(scheduledApplyAfterPaintFrame);
      scheduledApplyAfterPaintFrame = null;
    }
  }

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
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function updateModalResultCount() {
    if (!resultTotal || !resultVisible) return;

    resultTotal.textContent = String(allVideos.length || 0);
    resultVisible.textContent = String(currentFilteredVideos.length || 0);
  }

  function applyFiltersAndUpdateCount() {
    cancelScheduledFilterApply();
    applyFilters({ scrollAfterUpdate: false });
    updateModalResultCount();
    hasUnappliedModalChanges = false;

    if (shouldDispatchStateChangeAfterApply) {
      shouldDispatchStateChangeAfterApply = false;
      dispatchMobileFilterStateChanged();
    }

    if (document.body.dataset.filterScrollLocked === "true") {
      shouldCorrectScrollAfterUnlock = true;
    }
  }

  function scheduleFilterApplyAfterPaint(afterApply = null) {
    cancelScheduledFilterApply();

    scheduledApplyFrame = requestAnimationFrame(() => {
      scheduledApplyFrame = null;
      scheduledApplyAfterPaintFrame = requestAnimationFrame(() => {
        scheduledApplyAfterPaintFrame = null;
        applyFiltersAndUpdateCount();
        if (typeof afterApply === "function") afterApply();
      });
    });
  }

  function hasScheduledFilterApply() {
    return scheduledApplyFrame !== null || scheduledApplyAfterPaintFrame !== null;
  }

  function dispatchMobileFilterStateChanged() {
    window.dispatchEvent(new CustomEvent("tagFilterStateChanged", {
      detail: { source: "mobile-filter-modal" }
    }));
  }

  function configureSortButtons() {
    if (!sortSelect || sortButtonGroup) return;

    sortSelect.classList.add("hidden");

    sortButtonGroup = document.createElement("div");
    sortButtonGroup.className = "flex flex-wrap gap-2";
    sortButtonGroup.setAttribute("role", "group");
    sortButtonGroup.setAttribute("aria-label", "並び順");

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
        hasUnappliedModalChanges = true;
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
    shouldDispatchStateChangeAfterApply = true;
    applyFiltersAndUpdateCount();
  }

  function renderFormatTags() {
    if (!formatTagsContainer) return;

    const restoreFocus = window.FocusUtils.capture(formatTagsContainer);
    formatTagsContainer.innerHTML = "";

    getFormatValues().forEach(format => {
      const button = document.createElement("button");
      const presentation = window.FilterTagView.getPresentation("format", format, format);
      button.type = "button";
      button.className = getFormatButtonClass(false);
      window.FilterTagView.applyButton(button, presentation);
      button.addEventListener("click", () => {
        handleMobileTagClick("format", format, renderFormatTags, () => {
          if (typeSelect) typeSelect.value = "";
        });
      });

      formatTagsContainer.appendChild(button);

      if (format === "ライブ") appendLineBreak(formatTagsContainer);
    });
    restoreFocus();
  }

  function reorderCategoryTags() {
    if (!categoryTagsContainer) return;

    const buttons = [...categoryTagsContainer.querySelectorAll("button")];
    const sortedButtons = [...buttons].sort((a, b) => {
      const valueA = a.dataset.filterValue || "";
      const valueB = b.dataset.filterValue || "";
      const indexA = categoryOrder.indexOf(valueA);
      const indexB = categoryOrder.indexOf(valueB);

      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return String(valueA).localeCompare(String(valueB), "ja");
    });

    const isAlreadySorted = buttons.every((button, index) => button === sortedButtons[index]);
    if (isAlreadySorted) return;

    const restoreFocus = window.FocusUtils.capture(categoryTagsContainer);
    sortedButtons.forEach(button => {
      categoryTagsContainer.appendChild(button);
    });
    restoreFocus();
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

    const restoreFocus = window.FocusUtils.capture(roleTagsContainer);
    roleTagsContainer.innerHTML = "";

    sortByPreferredOrder(getSelectValues(roleSelect), roleOrder).forEach(role => {
      const button = document.createElement("button");
      const presentation = window.FilterTagView.getPresentation("role", role, role);
      button.type = "button";
      button.className = getTagButtonClass(
        "tag-role-filter",
        false,
        { size: "tag-sm" }
      );
      window.FilterTagView.applyButton(button, presentation);
      button.addEventListener("click", () => {
        handleMobileTagClick("role", role, renderRoleTags, () => {
          if (roleSelect) roleSelect.value = "";
        });
      });

      roleTagsContainer.appendChild(button);

      if (role === "ILLUSTRATION") appendLineBreak(roleTagsContainer);
    });
    restoreFocus();
  }

  function getCollabButtonClass(isActive) {
    return getTagButtonClass("tag-collab-liver", isActive, { size: "tag-sm" });
  }

  function renderCollabTagGroup(container, values) {
    if (!container) return;

    const restoreFocus = window.FocusUtils.capture(container);
    container.innerHTML = "";

    values.forEach(value => {
      const button = document.createElement("button");
      const presentation = window.FilterTagView.getPresentation("collab", value, value);
      button.type = "button";
      button.className = getCollabButtonClass(false);
      window.FilterTagView.applyButton(button, presentation);
      button.addEventListener("click", () => {
        handleMobileTagClick("collab", value, renderCollabTags);
      });

      container.appendChild(button);
    });
    restoreFocus();
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
    if (mobileSearchInput) mobileSearchInput.value = "";
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
    hasUnappliedModalChanges = true;
    shouldDispatchStateChangeAfterApply = true;
    scheduleFilterApplyAfterPaint();
  }

  function configureResetButton() {
    if (document.getElementById("resetModalFilters")) return;

    const actions = applyButton.parentElement;
    if (!actions) return;

    const resetButton = document.createElement("button");
    resetButton.id = "resetModalFilters";
    resetButton.type = "button";
    resetButton.className = "neutral-toolbar-button px-4 py-2 rounded-md";
    resetButton.textContent = "リセット";
    resetButton.addEventListener("click", resetModalFilters);

    applyButton.insertAdjacentElement("beforebegin", resetButton);
    actions.classList.remove("justify-between");
    actions.classList.add("justify-start", "gap-3", "items-center");
  }

  function syncModalValues() {
    if (sortSelect && sortOrder) sortOrder.value = sortSelect.value || "desc";
  }

  function syncModalControls() {
    if (sortSelect && sortOrder) sortSelect.value = sortOrder.value || "desc";
    if (categorySelect) categorySelect.value = window.FilterState.getState().include.category || "";
    if (roleSelect) roleSelect.value = "";
    if (typeSelect) typeSelect.value = "";
    renderCategoryTags([...new Set(allVideos.map(video => video["カテゴリ"]).filter(Boolean))].sort());
    renderPlatformTags();
    renderDateTags();
    updateSortButtons();
    renderMobileTagSections();
    updateModalResultCount();
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

  function unlockPageScroll(options = {}) {
    const { correctAfterUnlock = true } = options;
    if (document.body.dataset.filterScrollLocked !== "true") return;

    document.body.dataset.filterScrollLocked = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.overflow = "";
    window.scrollTo(0, lockedScrollY);

    const shouldCorrect = shouldCorrectScrollAfterUnlock;
    shouldCorrectScrollAfterUnlock = false;

    if (correctAfterUnlock && shouldCorrect) {
      window.FilterScrollPosition?.requestScrollAfterFilterUpdate({
        behavior: "smooth",
        waitForSettledLayout: true
      });
    }
  }

  openButton?.addEventListener("click", () => {
    if (modal.open) return;
    lockPageScroll();
    configureSortButtons();
    configureCategoryButtons();
    configureDateButtons();
    configureFormatButtons();
    configureRoleButtons();
    configureResetButton();
    observeCategoryTags();
    syncModalControls();
    modal.classList.remove("hidden");
    modal.showModal();
    panel.scrollTop = 0;
    window.FocusUtils.focus(panel);
  });

  function finishClosingModal() {
    if (document.querySelector('dialog[open]')) return;
    window.ScrollUtils?.requestFilterCloseTargetJump();
  }

  function closeModal(options = {}) {
    if (modal.classList.contains("hidden")) return;
    const { scrollToResults = true } = options;
    const needsApply = hasUnappliedModalChanges || hasScheduledFilterApply();
    cancelScheduledFilterApply();
    modal.classList.add("hidden");
    modal.close();
    unlockPageScroll({ correctAfterUnlock: false });
    if (!window.FocusUtils.focus(openButton)) {
      window.FocusUtils.focus(document.getElementById("desktopToggleFilters"));
    }

    if (needsApply) {
      scheduleFilterApplyAfterPaint(scrollToResults ? finishClosingModal : null);
      return;
    }

    if (scrollToResults) finishClosingModal();
  }

  applyButton.addEventListener("click", () => closeModal());
  modal.addEventListener("cancel", event => {
    event.preventDefault();
    closeModal();
  });
  modal.addEventListener("close", () => {
    if (!modal.open) closeModal();
  });
  modal.addEventListener("keydown", event => window.FocusUtils.containTab(event, modal));
  window.MobileFilterModal = Object.freeze({ close: closeModal });

  window.addEventListener("collabTagOrderReady", () => {
    renderCollabTags();
  });
  window.addEventListener("tagFilterStateChanged", event => {
    if (event.detail?.source === "mobile-filter-modal") {
      updateModalResultCount();
      return;
    }

    if (modal.classList.contains("hidden")) return;

    renderMobileTagSections();
    updateModalResultCount();
  });
})();
