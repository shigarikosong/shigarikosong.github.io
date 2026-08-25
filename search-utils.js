(() => {
  function parseSearchQuery(query) {
    const tokens = String(query || '').trim().split(/\s+/).filter(Boolean);
    const excludeTerms = [];
    const groups = [[]];

    tokens.forEach(token => {
      const operator = token.toUpperCase();

      if (token.startsWith('-') && token.length > 1) {
        excludeTerms.push(token.slice(1).toLowerCase());
        return;
      }

      if (operator === 'AND') return;

      if (operator === 'OR') {
        if (groups[groups.length - 1].length) groups.push([]);
        return;
      }

      groups[groups.length - 1].push(token.toLowerCase());
    });

    return {
      excludeTerms,
      groups: groups.filter(group => group.length)
    };
  }

  function matchesParsedSearchQuery(video, parsedQuery) {
    const { excludeTerms, groups } = parsedQuery;
    if (!excludeTerms.length && !groups.length) return true;

    const text = video?._searchText || '';
    if (excludeTerms.some(term => text.includes(term))) return false;
    if (!groups.length) return true;

    return groups.some(group => group.every(term => text.includes(term)));
  }

  function matchesSearchQuery(video, query) {
    return matchesParsedSearchQuery(video, parseSearchQuery(query));
  }

  window.SearchUtils = Object.freeze({
    parseSearchQuery,
    matchesParsedSearchQuery,
    matchesSearchQuery
  });
})();
