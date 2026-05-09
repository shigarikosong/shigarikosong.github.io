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

  function getCollabButtonLabel(button) {
    return String(button.textContent || "").trim();
  }

  function getCollabSortInfo(button) {
    const label = getCollabButtonLabel(button);
    const info = collabTagOrder.get(label);

    return {
      label,
      sortOrder: info?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      kana: info?.kana || "",
      originalIndex: Number(button.dataset.collabSortOriginalIndex || 0)
    };
  }

  function sortCollabTagContainer(container) {
    if (!container || isSortingCollabTags) return;

    const buttons = [...container.children].filter(child => child.tagName === "BUTTON");
    if (buttons.length <= 1) return;

    buttons.forEach((button, index) => {
      if (!button.dataset.collabSortOriginalIndex) {
        button.dataset.collabSortOriginalIndex = String(index);
      }
    });

    const sorted = [...buttons].sort((a, b) => {
      const tagA = getCollabSortInfo(a);
      const tagB = getCollabSortInfo(b);

      if (tagA.sortOrder !== tagB.sortOrder) {
        return tagA.sortOrder - tagB.sortOrder;
      }

      if (tagA.sortOrder === Number.MAX_SAFE_INTEGER) {
        return tagA.originalIndex - tagB.originalIndex;
      }

      const kanaCompare = tagA.kana.localeCompare(tagB.kana, "ja");
      if (kanaCompare !== 0) return kanaCompare;

      return tagA.label.localeCompare(tagB.label, "ja");
    });

    const changed = sorted.some((button, index) => button !== buttons[index]);
    if (!changed) return;

    isSortingCollabTags = true;
    sorted.forEach(button => container.appendChild(button));
    isSortingCollabTags = false;
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
        if (!isSortingCollabTags) sortCollabTagContainer(container);
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
        rows.forEach(row => {
          const tagName = String(row.tag_name || "").trim();
          if (!tagName) return;

          const sortOrder = Number(row.sort_order);
          collabTagOrder.set(tagName, {
            sortOrder: Number.isFinite(sortOrder) ? sortOrder : Number.MAX_SAFE_INTEGER,
            kana: String(row.kana || "").trim(),
            type: String(row.type || "").trim()
          });
        });

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
