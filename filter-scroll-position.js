(function () {
  function requestScrollAfterFilterUpdate(options = {}) {
    if (typeof window.requestSettledFilterScroll === "function") {
      window.requestSettledFilterScroll(options);
    }
  }

  window.FilterScrollPosition = Object.freeze({
    requestScrollAfterFilterUpdate
  });
})();
