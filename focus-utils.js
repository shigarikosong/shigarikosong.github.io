(() => {
  function isAvailable(element) {
    if (!element?.isConnected || element.disabled) return false;
    if (element.closest('[hidden], [inert]')) return false;
    for (let parent = element; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  }

  function focus(element) {
    if (!isAvailable(element)) return false;
    element.focus({ preventScroll: true });
    return document.activeElement === element;
  }

  function capture(container, fallback = null) {
    const active = document.activeElement;
    if (!container?.contains(active)) return () => {};

    const key = active.dataset.focusKey;
    const id = active.id;
    const scope = active.closest('[data-focus-scope]')?.dataset.focusScope;
    return () => {
      if (active.isConnected && document.activeElement === active) return;
      if (document.activeElement !== document.body && document.activeElement !== active) return;

      // Card-local keys must never resolve to the same action in another card.
      const root = scope === undefined ? container : [...container.querySelectorAll('[data-focus-scope]')]
        .find(element => element.dataset.focusScope === scope);
      const replacement = root && [...root.querySelectorAll('[data-focus-key], [id]')]
        .find(element => key !== undefined ? element.dataset.focusKey === key : id && element.id === id);
      if (!focus(replacement)) focus(typeof fallback === 'function' ? fallback() : fallback);
    };
  }

  function containTab(event, dialog) {
    if (event.key !== 'Tab' || !dialog.open) return;
    const controls = [...dialog.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
      .filter(element => element.tabIndex >= 0 && isAvailable(element));
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) {
      event.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !controls.includes(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  window.FocusUtils = Object.freeze({ capture, focus, containTab });
})();
