(function () {
  const link = document.getElementById('siteHomeLink');
  if (!link) return;

  link.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const home = new URL(link.href);
    if (home.origin !== location.origin || home.pathname !== location.pathname
      || home.search !== location.search) return;

    // Fragment-only navigation does not reload the document.
    event.preventDefault();
    if (location.href !== home.href) history.pushState(null, '', home.href);
    window.scrollTo(0, 0);
    location.reload();
  });
})();
