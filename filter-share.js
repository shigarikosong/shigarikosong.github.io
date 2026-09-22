(() => {
  const buttons = [...document.querySelectorAll('[data-share-filters]')];
  const toast = document.getElementById('filterShareToast');
  const dialog = document.getElementById('filterShareDialog');
  const urlInput = document.getElementById('filterShareUrlInput');
  let ready = false;
  let hadSharedHash = false;
  let lastSignature = '';
  let copyRequest = 0;
  let toastTimer = null;
  let dialogOpener = null;
  let previousOverflow = '';

  function clearToast() {
    clearTimeout(toastTimer);
    toast.hidden = true;
    toast.textContent = '';
  }

  function showToast(message) {
    clearToast();
    toast.hidden = false;
    toast.textContent = message;
    toastTimer = setTimeout(clearToast, 5000);
  }

  function updateControls() {
    const state = window.FilterState.getState();
    const signature = JSON.stringify(state);
    if (signature !== lastSignature) {
      copyRequest++;
      clearToast();
      lastSignature = signature;
    }
    const hasConditions = Boolean(state.searchQuery.trim()) || state.sortOrder !== 'desc' ||
      Object.values(state.include).some(value => value.length > 0) ||
      Object.values(state.exclude).some(value => value.length > 0);
    buttons.forEach(button => {
      if (!hasConditions && document.activeElement === button) {
        window.FocusUtils.focus(document.getElementById('mobileSearchInput')) ||
          window.FocusUtils.focus(document.getElementById('searchInput'));
      }
      button.hidden = !hasConditions;
    });
  }

  function closeDialog() {
    if (!dialogOpener) return;
    const opener = dialogOpener;
    dialogOpener = null;
    if (dialog.open) dialog.close();
    document.body.style.overflow = previousOverflow;
    urlInput.value = '';
    if (!window.FocusUtils.focus(opener)) {
      window.FocusUtils.focus(document.getElementById('mobileSearchInput')) ||
        window.FocusUtils.focus(document.getElementById('searchInput'));
    }
  }

  async function copyFilters(event) {
    const button = event.currentTarget;
    if (!ready || button.hidden) return;
    const request = ++copyRequest;
    let url;
    try {
      url = window.FilterShareUrl.createUrl(window.FilterState.getState(), location.href);
    } catch {
      showToast('条件が多すぎるか対応していないため、共有URLを作成できませんでした。');
      return;
    }
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      // Keep a manual-copy path for browsers that deny clipboard access.
    }
    if (request !== copyRequest || button.hidden || document.querySelector('dialog[open]')) return;
    if (copied) {
      showToast('検索・絞り込み条件のURLをコピーしました');
      return;
    }
    clearToast();
    dialogOpener = button;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    urlInput.value = url;
    dialog.showModal();
    window.FocusUtils.focus(urlInput);
    urlInput.select();
  }

  function restoreInitialState() {
    if (ready) return false;
    ready = true;
    return restoreHash();
  }

  function restoreHash() {
    const parsed = window.FilterShareUrl.parse(location.hash);
    if (parsed.kind === 'unrelated' || (parsed.kind === 'empty' && !hadSharedHash)) return false;
    hadSharedHash = parsed.kind !== 'empty';
    closeDialog();
    copyRequest++;
    clearToast();
    window.FilterState.setState(parsed.state || window.FilterShareUrl.emptyState());
    window.dispatchEvent(new CustomEvent('tagFilterStateChanged', { detail: { source: 'shared-filter-url' } }));
    return parsed.kind === 'invalid';
  }

  function showInvalidUrlNotice() {
    showToast('共有URLの条件を読み込めませんでした。通常の一覧を表示しています。');
  }

  buttons.forEach(button => button.addEventListener('click', copyFilters));
  document.getElementById('closeFilterShareDialog').addEventListener('click', closeDialog);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
  dialog.addEventListener('close', closeDialog);
  dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });
  dialog.addEventListener('keydown', event => window.FocusUtils.containTab(event, dialog));
  window.addEventListener('hashchange', () => {
    if (!ready) return;
    const parsed = window.FilterShareUrl.parse(location.hash);
    if (parsed.kind === 'unrelated' || (parsed.kind === 'empty' && !hadSharedHash)) return;
    const invalid = restoreHash();
    window.applyFilters({ scrollAfterUpdate: !document.querySelector('dialog[open]') });
    if (invalid) showInvalidUrlNotice();
  });

  window.FilterShare = Object.freeze({ restoreInitialState, updateControls, showInvalidUrlNotice });
})();
