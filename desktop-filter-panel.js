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

  const categoryOrder = ["ソロ", "コラボ", "あやかき"];
  const formatOrder = ["3D", "Shorts", "歌枠", "ライブ", "Full", "ハイライト", "アカペラ", "企画", "比較"];
  const roleOrder = ["VOCAL", "DANCE", "CHORUS", "MOVIE", "ILLUSTRATION", "PIANO", "EUPHONIUM", "KALIMBA"];

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

  function buttonClass(isActive, color) {
    const colors = {
      blue: isActive
        ? "border border-blue-600 text-white bg-blue-600"
        : "border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100",
      purple: isActive
        ? "border border-purple-600 text-white bg-purple-600"
        : "border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100",
      green: isActive
        ? "border border-green-600 text-white bg-green-600"
        : "border border-green-200 text-green-700 bg-green-50 hover:bg-green-100",
      pink: isActive
        ? "border border-pink-600 text-white bg-pink-600"
        : "border border-pink-200 text-pink-700 bg-pink-50 hover:bg-pink-100",
      yellow: isActive
        ? "border border-yellow-600 text-white bg-yellow-600"
        : "border border-yellow-200 text-yellow-800 bg-yellow-50 hover:bg-yellow-100",
      gray: isActive
        ? "border border-gray-600 text-white bg-gray-600"
        : "border border-gray-200 text-gray-700 bg-white hover:bg-gray-100"
    };

    return `${colors[color] || colors.gray} px-4 py-2 rounded-full text-sm font-medium transition`;
  }

  function createButton(label, isActive, color, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = buttonClass(isActive, color);
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
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

  function renderSortButtons() {
    if (!sortSelect || !sortButtons) return;

    sortButtons.innerHTML = "";
    [...sortSelect.options].forEach(option => {
      const value = option.value;
      const isActive = sortSelect.value === value;

      sortButtons.appendChild(createButton(sortLabels[value] || option.textContent, isActive, "blue", () => {
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
        formatTags.appendChild(createButton(value, selected3DTag === "include", "pink", () => {
          selected3DTag = toggleTagState(selected3DTag);
          applyFilters();
          renderFormatTags();
        }));
      } else if (value === "Shorts") {
        formatTags.appendChild(createButton(value, selectedShortsTag === "include", "pink", () => {
          selectedShortsTag = toggleTagState(selectedShortsTag);
          applyFilters();
          renderFormatTags();
        }));
      } else {
        formatTags.appendChild(createButton(value, selectedVideoTypeTags.has(value), "pink", () => {
          toggleVideoTypeTag(value);
          applyFilters();
          renderFormatTags();
        }));
      }

      appendWrap(formatTags, index, 3);
    });
  }

  function renderRoleTags() {
    if (!roleTags) return;

    const values = sortByOrder(getSelectValues("modalRoleFilter"), roleOrder);
    roleTags.innerHTML = "";

    values.forEach((value, index) => {
      roleTags.appendChild(createButton(value, selectedRoleTag === value, "yellow", () => {
        selectedRoleTag = selectedRoleTag === value ? "" : value;
        applyFilters();
        renderRoleTags();
      }));

      appendWrap(roleTags, index, 4);
    });
  }

  function renderCollabGroup(container, values, color) {
    if (!container) return;

    container.innerHTML = "";
    values.sort((a, b) => String(a).localeCompare(String(b), "ja")).forEach(value => {
      container.appendChild(createButton(value, selectedCollabTag === value, color, () => {
        selectedCollabTag = selectedCollabTag === value ? "" : value;
        applyFilters();
        renderCollabTags();
      }));
    });
  }

  function renderCollabTags() {
    renderCollabGroup(collabLiverTags, getColumnValues("コラボライバー"), "gray");
    renderCollabGroup(collabUnitTags, getColumnValues("コラボユニット"), "blue");
  }

  function renderDesktopPanel() {
    renderSortButtons();
    reorderCategoryTags();
    renderFormatTags();
    renderRoleTags();
    renderCollabTags();
  }

  toggleButton.addEventListener("click", () => {
    const isHidden = panel.classList.toggle("hidden");
    const isOpen = !isHidden;

    toggleButton.setAttribute("aria-expanded", String(isOpen));
    toggleButton.textContent = isOpen ? "閉じる" : "絞り込み";

    if (isOpen) renderDesktopPanel();
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
})();
