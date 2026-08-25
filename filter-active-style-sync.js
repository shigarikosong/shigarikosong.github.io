(() => {
  const syncRootSelectors = ['#filterModal', '#desktopFilterPanel', '#videoList'];
  const filterButtonSelector = syncRootSelectors
    .map(selector => `${selector} button[data-filter-group][data-filter-value]`)
    .join(', ');
  const activeClassByBaseClass = Object.freeze({
    'tag-style': 'tag-style-active',
    'tag-platform': 'tag-platform-active',
    'tag-time': 'tag-time-active',
    'tag-format': 'tag-format-active',
    'tag-role-filter': 'tag-role-filter-active',
    'tag-collab-liver': 'tag-collab-liver-active',
    'tag-collab-unit': 'tag-collab-unit-active'
  });
  let syncFrame = null;

  function getActiveClass(button) {
    return Object.entries(activeClassByBaseClass)
      .find(([baseClass]) => button.classList.contains(baseClass))?.[1] || null;
  }

  function syncButton(button) {
    const activeClass = getActiveClass(button);
    if (!activeClass) return;

    const group = button.dataset.filterGroup;
    const value = button.dataset.filterValue;
    const isActive = window.FilterState.isTagIncluded(group, value);
    button.classList.toggle(activeClass, isActive);
  }

  function syncActiveFilterTags() {
    document.querySelectorAll(filterButtonSelector).forEach(syncButton);
  }

  function requestSync() {
    if (syncFrame !== null) return;

    syncFrame = requestAnimationFrame(() => {
      syncFrame = null;
      syncActiveFilterTags();
    });
  }

  window.addEventListener('tagFilterStateChanged', requestSync);
  window.addEventListener('videoListRendered', requestSync);
  requestSync();
})();
