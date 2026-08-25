(() => {
  const kindByGroup = {
    category: 'tag-style',
    platform: 'tag-platform',
    date: 'tag-time',
    format: 'tag-format',
    role: 'tag-role-filter',
    collabLiver: 'tag-collab-liver',
    collabUnit: 'tag-collab-unit'
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

  function getActiveLabels() {
    return new Set(
      [...document.querySelectorAll('#activeTagChipsInner button')]
        .map(button => normalizeLabel(button.textContent))
        .filter(Boolean)
    );
  }

  function setButtonClass(button, group, isActive) {
    const kind = kindByGroup[group];
    if (!kind) return;

    button.classList.toggle(`${kind}-active`, isActive);
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
    document.querySelectorAll('#videoList button[data-filter-group="platform"]').forEach(button => {
      const label = normalizeLabel(button.dataset.filterValue || button.textContent);
      if (!platformLabels.has(label)) return;

      const isActive = activeLabels.has(label);
      button.classList.toggle('tag-platform-active', isActive);
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
