(() => {
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  function isPlayingCard(element) {
    return element instanceof Element &&
      element.classList.contains('playing') &&
      Boolean(element.closest('#videoList'));
  }

  function getVisibleFixedHeight(element) {
    if (!element || element.classList.contains('hidden')) return 0;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return 0;

    const rect = element.getBoundingClientRect();
    return rect.height > 0 ? rect.height : 0;
  }

  function getBottomReservedHeight() {
    const fixedPlayer = document.getElementById('fixedPlayer');
    const nowPlaying = document.getElementById('nowPlayingWrapper');

    return getVisibleFixedHeight(fixedPlayer) + getVisibleFixedHeight(nowPlaying) + 16;
  }

  function scrollPlayingCardIntoView(element, options) {
    const rect = element.getBoundingClientRect();
    const pageTop = window.scrollY + rect.top;
    const bottomReserved = getBottomReservedHeight();
    const topReserved = window.innerWidth < 640 ? 56 : 72;
    const usableHeight = Math.max(240, window.innerHeight - bottomReserved - topReserved);

    let targetY;

    if (rect.height >= usableHeight) {
      targetY = pageTop - topReserved;
    } else {
      const visualOffset = usableHeight * 0.28;
      targetY = pageTop - topReserved - visualOffset;
    }

    window.scrollTo({
      top: Math.max(0, Math.round(targetY)),
      behavior: options?.behavior || 'smooth'
    });
  }

  Element.prototype.scrollIntoView = function patchedScrollIntoView(options) {
    if (isPlayingCard(this)) {
      scrollPlayingCardIntoView(this, options);
      return;
    }

    return originalScrollIntoView.call(this, options);
  };
})();

(() => {
  const classByGroup = {
    category: {
      active: 'bg-blue-600 text-white px-3 py-1 rounded-full text-xs',
      inactive: 'bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs'
    },
    platform: {
      active: 'bg-purple-600 text-white px-3 py-1 rounded-full text-xs',
      inactive: 'bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs'
    },
    date: {
      active: 'bg-green-600 text-white px-3 py-1 rounded-full text-xs',
      inactive: 'bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs'
    },
    format: {
      active: 'bg-pink-600 text-white px-3 py-1 rounded-full text-xs',
      inactive: 'bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-xs'
    },
    role: {
      active: 'bg-yellow-400 text-yellow-950 px-3 py-1 rounded-full text-xs',
      inactive: 'bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs'
    },
    collabLiver: {
      active: 'bg-gray-600 text-white px-3 py-1 rounded-full text-xs',
      inactive: 'bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs'
    },
    collabUnit: {
      active: 'bg-blue-600 text-white px-3 py-1 rounded-full text-xs',
      inactive: 'bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs'
    }
  };

  const panelGroups = [
    ['modalCategoryTags', 'category'],
    ['desktopCategoryTags', 'category'],
    ['modalPlatformTags', 'platform'],
    ['desktopPlatformTags', 'platform'],
    ['modalDateTags', 'date'],
    ['desktopDateTags', 'date'],
    ['modalFormatTags', 'format'],
    ['desktopFormatTags', 'format'],
    ['modalRoleTags', 'role'],
    ['desktopRoleTags', 'role'],
    ['modalCollabLiverTags', 'collabLiver'],
    ['desktopCollabLiverTags', 'collabLiver'],
    ['modalCollabUnitTags', 'collabUnit'],
    ['desktopCollabUnitTags', 'collabUnit']
  ];

  const platformLabels = new Set(['youtube', 'tiktok']);
  let syncScheduled = false;
  let delayedSyncTimer = null;

  function normalizeLabel(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isPlatformActiveButton(button) {
    const label = normalizeLabel(button.textContent);
    return platformLabels.has(label) &&
      button.classList.contains('bg-purple-600');
  }

  function getActiveLabels() {
    const labels = new Set(
      [...document.querySelectorAll('#activeTagChipsInner button')]
        .map(button => normalizeLabel(button.textContent))
        .filter(Boolean)
    );

    document
      .querySelectorAll('#modalPlatformTags button, #desktopPlatformTags button')
      .forEach(button => {
        if (isPlatformActiveButton(button)) {
          labels.add(normalizeLabel(button.textContent));
        }
      });

    return labels;
  }

  function setButtonClass(button, group, isActive) {
    const classes = classByGroup[group];
    if (!classes) return;

    const nextClassName = isActive ? classes.active : classes.inactive;
    if (button.className !== nextClassName) {
      button.className = nextClassName;
    }
  }

  function syncPanelButtons(activeLabels) {
    panelGroups.forEach(([id, group]) => {
      const container = document.getElementById(id);
      if (!container) return;

      container.querySelectorAll('button').forEach(button => {
        const isActive = activeLabels.has(normalizeLabel(button.textContent));
        setButtonClass(button, group, isActive);
      });
    });
  }

  function syncListPlatformButtons(activeLabels) {
    document.querySelectorAll('#videoList button').forEach(button => {
      const label = normalizeLabel(button.textContent);
      if (!platformLabels.has(label)) return;

      const nextClassName = activeLabels.has(label)
        ? 'border border-purple-600 text-white bg-purple-600 px-2.5 py-1 rounded-full text-xs hover:bg-purple-600'
        : 'border border-purple-300 text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full text-xs hover:bg-purple-100';

      if (button.className !== nextClassName) {
        button.className = nextClassName;
      }
    });
  }

  function syncActiveFilterTags() {
    const activeLabels = getActiveLabels();
    syncPanelButtons(activeLabels);
    syncListPlatformButtons(activeLabels);
  }

  function scheduleSync() {
    if (syncScheduled) return;
    syncScheduled = true;

    requestAnimationFrame(() => {
      syncScheduled = false;
      syncActiveFilterTags();
    });
  }

  function scheduleDelayedSync() {
    scheduleSync();
    clearTimeout(delayedSyncTimer);
    delayedSyncTimer = setTimeout(scheduleSync, 80);
  }

  document.addEventListener('click', scheduleDelayedSync, true);
  document.addEventListener('input', scheduleDelayedSync, true);
  document.addEventListener('change', scheduleDelayedSync, true);

  const observer = new MutationObserver(scheduleSync);

  function startObserverWhenReady() {
    const videoList = document.getElementById('videoList');
    const activeTagChipsInner = document.getElementById('activeTagChipsInner');

    if (!videoList || !activeTagChipsInner) {
      requestAnimationFrame(startObserverWhenReady);
      return;
    }

    observer.observe(videoList, { childList: true, subtree: true });
    observer.observe(activeTagChipsInner, { childList: true, subtree: true, characterData: true });
    scheduleSync();
  }

  startObserverWhenReady();
})();
