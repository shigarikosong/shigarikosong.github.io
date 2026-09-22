(() => {
  const groups = ['category', 'platform', 'date', 'format', 'role', 'collab', 'flag'];
  const singleGroups = new Set(['category', 'platform', 'date']);
  const sortValues = new Set(['desc', 'asc', 'title', 'artist']);
  const maxHashLength = 16000;

  function emptyState() {
    return {
      searchQuery: '',
      sortOrder: 'desc',
      include: Object.fromEntries(groups.map(group => [group, singleGroups.has(group) ? '' : []])),
      exclude: Object.fromEntries(groups.map(group => [group, []]))
    };
  }

  function isValidTag(group, value) {
    if (!value.trim()) return false;
    if (group === 'platform') return window.TAG_CONFIG.platformValues.includes(value);
    if (group === 'date') return Object.hasOwn(window.TAG_CONFIG.dateLabels, value);
    if (group === 'flag') return value === '3D' || value === 'Shorts';
    // Data-defined tags survive renaming/removal as explicit (possibly empty) conditions.
    return true;
  }

  function serialize(state) {
    const params = new URLSearchParams({ filters: '1' });
    if (state.searchQuery?.trim()) params.set('q', state.searchQuery);
    const sort = state.sortOrder || 'desc';
    if (!sortValues.has(sort)) throw new TypeError('Invalid shared sort');
    if (sort !== 'desc') params.set('sort', sort);
    for (const mode of ['include', 'exclude']) {
      for (const group of groups) {
        const raw = state[mode]?.[group];
        const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
        for (const value of [...new Set(values)].sort()) {
          if (!isValidTag(group, value)) throw new TypeError('Invalid shared tag');
          params.append(`${mode === 'include' ? 'in' : 'out'}.${group}`, value);
        }
      }
    }
    if (params.size === 1) return '';
    const hash = `#${params}`;
    if (hash.length > maxHashLength) throw new RangeError('Shared filters are too long');
    return hash;
  }

  function parse(hash) {
    const raw = String(hash || '').replace(/^#/, '');
    if (!raw) return { kind: 'empty', state: emptyState() };
    const params = new URLSearchParams(raw);
    if (!params.has('filters')) return { kind: 'unrelated' };
    try {
      if (raw.length + 1 > maxHashLength) throw new RangeError();
      decodeURIComponent(raw);
      if (params.getAll('filters').length !== 1 || params.get('filters') !== '1') throw new TypeError();
      const state = emptyState();
      for (const [key, value] of params) {
        if (key === 'filters') continue;
        if (key === 'q' || key === 'sort') {
          if (params.getAll(key).length !== 1) throw new TypeError();
          if (key === 'sort' && !sortValues.has(value)) throw new TypeError();
          state[key === 'q' ? 'searchQuery' : 'sortOrder'] = value;
          continue;
        }
        const [prefix, group, extra] = key.split('.');
        if (!['in', 'out'].includes(prefix) || !groups.includes(group) || extra !== undefined || !isValidTag(group, value)) {
          throw new TypeError();
        }
        const target = state[prefix === 'in' ? 'include' : 'exclude'];
        if (prefix === 'in' && singleGroups.has(group)) {
          if (params.getAll(key).length !== 1) throw new TypeError();
          target[group] = value;
        } else if (!target[group].includes(value)) {
          target[group].push(value);
        }
      }
      return { kind: 'shared', state };
    } catch {
      return { kind: 'invalid' };
    }
  }

  function createUrl(state, baseUrl) {
    const url = new URL(baseUrl);
    url.search = '';
    url.hash = serialize(state);
    return url.href;
  }

  window.FilterShareUrl = Object.freeze({ emptyState, serialize, parse, createUrl });
})();
