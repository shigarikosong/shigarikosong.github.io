(function () {
  const songCount = document.getElementById("songCount");
  const desktopResultCount = document.getElementById("desktopResultCount");
  const desktopResultTotal = document.getElementById("desktopResultTotal");
  const desktopResultVisible = document.getElementById("desktopResultVisible");
  const fixedPlayer = document.getElementById("fixedPlayer");
  const nowPlayingWrapper = document.getElementById("nowPlayingWrapper");
  const COLLAB_TAGS_URL = "https://opensheet.elk.sh/1sZGH3TGYdC5UShrIEFEe2T8-axXEFet6qsxbqCoHX5o/collab_tags";
  const COLLAB_TAG_CONTAINER_IDS = [
    "modalCollabLiverTags",
    "modalCollabUnitTags",
    "desktopCollabLiverTags",
    "desktopCollabUnitTags"
  ];
  const collabTagOrder = new Map();
  const collabTagObservers = new Map();
  let isSortingCollabTags = false;
  const pendingCollabSortContainers = new Set();
  let isCollabTagOrderReady = false;

  function syncDesktopResultCount() {
    if (!songCount || !desktopResultCount || !desktopResultTotal || !desktopResultVisible) return;

    const match = songCount.textContent.match(/(\d+)\D+(\d+)/);
    if (!match) return;

    desktopResultTotal.textContent = match[1];
    desktopResultVisible.textContent = match[2];
    desktopResultCount.classList.remove("hidden");
  }

  function isFixedPlayerVisible() {
    if (!fixedPlayer) return false;
    return getComputedStyle(fixedPlayer).display !== "none";
  }

  function syncPlayerControlsVisibility() {
    if (!fixedPlayer || !nowPlayingWrapper) return;

    if (isFixedPlayerVisible()) {
      document.body.classList.add("player-visible");
      nowPlayingWrapper.classList.remove("hidden");
      requestAnimationFrame(() => {
        if (typeof adjustFixedPlayerBottom === "function") adjustFixedPlayerBottom();
      });
    } else {
      document.body.classList.remove("player-visible");
      nowPlayingWrapper.classList.add("hidden");
      document.body.style.paddingBottom = "0px";
    }
  }

  function parseCommaTags(value) {
    return String(value || "")
      .split(",")
      .map(v => v.trim())
      .filter(Boolean);
  }

  function normalizeCollabTag(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function getRowValue(row, keys) {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];

      const matchedKey = Object.keys(row).find(rowKey => normalizeCollabTag(rowKey) === key);
      if (matchedKey) return row[matchedKey];
    }

    return "";
  }

  function parseSortOrder(value) {
    const rawValue = String(value ?? "").trim();
    if (!rawValue) return Number.MAX_SAFE_INTEGER;

    const sortOrder = Number(rawValue);
    return Number.isFinite(sortOrder) ? sortOrder : Number.MAX_SAFE_INTEGER;
  }

  function getCollabButtonLabel(button) {
    return normalizeCollabTag(button.dataset.filterValue || button.textContent);
  }

  function getCollabSortInfoByLabel(label) {
    const normalizedLabel = normalizeCollabTag(label);
    const info = collabTagOrder.get(normalizedLabel);

    return {
      label: normalizedLabel,
      sortOrder: info?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      kana: info?.kana || "",
      matched: Boolean(info)
    };
  }

  function compareCollabLabels(a, b) {
    const tagA = getCollabSortInfoByLabel(a);
    const tagB = getCollabSortInfoByLabel(b);

    if (tagA.sortOrder !== tagB.sortOrder) {
      return tagA.sortOrder - tagB.sortOrder;
    }

    const kanaCompare = tagA.kana.localeCompare(tagB.kana, "ja");
    if (kanaCompare !== 0) return kanaCompare;

    return tagA.label.localeCompare(tagB.label, "ja");
  }

  function sortCollabTagValues(values) {
    return [...values].sort(compareCollabLabels);
  }

  function debugCollabTagOrder(values) {
    const rows = sortCollabTagValues(values).map(value => {
      const info = getCollabSortInfoByLabel(value);
      return {
        tag_name: info.label,
        sort_order: info.sortOrder === Number.MAX_SAFE_INTEGER ? "" : info.sortOrder,
        kana: info.kana,
        matched: info.matched
      };
    });

    console.table(rows);
    return rows;
  }

  function exposeCollabTagOrder() {
    window.isCollabTagOrderReady = isCollabTagOrderReady;
    window.getCollabTagSortInfo = getCollabSortInfoByLabel;
    window.sortCollabTagValues = sortCollabTagValues;
    window.debugCollabTagOrder = debugCollabTagOrder;
  }

  function notifyCollabTagOrderReady() {
    exposeCollabTagOrder();
    window.dispatchEvent(new CustomEvent("collabTagOrderReady"));
  }

  function getCollabSortInfo(button) {
    return getCollabSortInfoByLabel(getCollabButtonLabel(button));
  }

  function sortCollabTagContainer(container) {
    if (!container || isSortingCollabTags) return;

    const buttons = [...container.children].filter(child => child.tagName === "BUTTON");
    if (buttons.length <= 1) return;

    const sorted = [...buttons].sort((a, b) => compareCollabLabels(getCollabButtonLabel(a), getCollabButtonLabel(b)));

    const changed = sorted.some((button, index) => button !== buttons[index]);
    if (!changed) return;

    isSortingCollabTags = true;
    sorted.forEach(button => container.appendChild(button));
    isSortingCollabTags = false;
  }

  function scheduleSortCollabTagContainer(container) {
    if (!container || pendingCollabSortContainers.has(container)) return;

    pendingCollabSortContainers.add(container);
    requestAnimationFrame(() => {
      pendingCollabSortContainers.delete(container);
      sortCollabTagContainer(container);
    });
  }

  function sortAllCollabTagContainers() {
    COLLAB_TAG_CONTAINER_IDS.forEach(id => {
      sortCollabTagContainer(document.getElementById(id));
    });
  }

  function observeCollabTagContainers() {
    COLLAB_TAG_CONTAINER_IDS.forEach(id => {
      const container = document.getElementById(id);
      if (!container || collabTagObservers.has(container)) return;

      const observer = new MutationObserver(() => {
        if (!isSortingCollabTags) scheduleSortCollabTagContainer(container);
      });
      observer.observe(container, { childList: true });
      collabTagObservers.set(container, observer);
      sortCollabTagContainer(container);
    });
  }

  function loadCollabTagOrder() {
    fetch(COLLAB_TAGS_URL)
      .then(response => response.ok ? response.json() : [])
      .then(rows => {
        if (!Array.isArray(rows)) return;

        rows.forEach(row => {
          const tagName = normalizeCollabTag(getRowValue(row, ["tag_name", "タグ名", "tag", "name"]));
          if (!tagName) return;

          collabTagOrder.set(tagName, {
            sortOrder: parseSortOrder(getRowValue(row, ["sort_order", "sort order", "表示順", "並び順", "order"])),
            kana: normalizeCollabTag(getRowValue(row, ["kana", "かな", "ふりがな", "読み"])),
            type: normalizeCollabTag(getRowValue(row, ["type", "種別", "区分"]))
          });
        });

        isCollabTagOrderReady = true;
        notifyCollabTagOrderReady();
        sortAllCollabTagContainers();
      })
      .catch(() => {
        // collab_tags が読めない場合は、元の表示順のまま使う。
      });
  }

  function compactCollabMembers(videos) {
    const cards = [...document.querySelectorAll("#videoList > div")];

    cards.forEach((card, index) => {
      const video = videos[index];
      if (!video) return;

      const collabLivers = parseCommaTags(video["コラボライバー"]);
      const collabUnits = parseCommaTags(video["コラボユニット"]);

      if (!collabLivers.length || !collabUnits.length) return;

      const rows = [...card.children];
      const collabRow = rows[rows.length - 1];
      if (!collabRow || !collabRow.querySelector("button")) return;

      const memberButtons = collabLivers
        .map(name => {
          const button = [...collabRow.querySelectorAll("button")]
            .find(btn => btn.textContent.trim() === name);
          if (button) button.dataset.collabMember = name;
          return button;
        })
        .filter(Boolean);

      if (!memberButtons.length) return;

      let memberRow = collabRow.querySelector(".collab-member-row");
      let toggleButton = collabRow.querySelector(".collab-member-toggle");

      if (!memberRow) {
        memberRow = document.createElement("div");
        memberRow.className = "collab-member-row basis-full flex flex-wrap gap-1.5";
      }

      memberButtons.forEach(button => memberRow.appendChild(button));
      const shouldShowMembers = memberButtons.some(button => button.classList.contains("bg-gray-600"));

      if (!toggleButton) {
        toggleButton = document.createElement("button");
        toggleButton.type = "button";
        toggleButton.className = "collab-member-toggle border border-gray-300 text-gray-600 bg-gray-50 px-2.5 py-1 rounded-full text-xs hover:bg-gray-100 transition";
      }

      const setMemberRowVisibility = (show) => {
        memberRow.classList.toggle("hidden", !show);
        toggleButton.textContent = show ? "閉じる" : `+${collabLivers.length}`;
      };

      setMemberRowVisibility(shouldShowMembers);
      toggleButton.onclick = () => setMemberRowVisibility(memberRow.classList.contains("hidden"));

      collabRow.appendChild(toggleButton);
      collabRow.appendChild(memberRow);
    });
  }

  function wrapRenderVideoList() {
    if (typeof window.renderVideoList !== "function" || window.renderVideoList.isCollabCompactWrapped) {
      return;
    }

    const originalRenderVideoList = window.renderVideoList;
    window.renderVideoList = function wrappedRenderVideoList(videos) {
      originalRenderVideoList(videos);
      compactCollabMembers(videos || []);
    };
    window.renderVideoList.isCollabCompactWrapped = true;
  }

  syncDesktopResultCount();
  syncPlayerControlsVisibility();
  exposeCollabTagOrder();
  observeCollabTagContainers();
  loadCollabTagOrder();
  wrapRenderVideoList();

  if (songCount) {
    const countObserver = new MutationObserver(syncDesktopResultCount);
    countObserver.observe(songCount, { childList: true, characterData: true, subtree: true });
  }

  if (fixedPlayer) {
    const playerObserver = new MutationObserver(syncPlayerControlsVisibility);
    playerObserver.observe(fixedPlayer, { attributes: true, attributeFilter: ["style", "class"] });
  }
})();
