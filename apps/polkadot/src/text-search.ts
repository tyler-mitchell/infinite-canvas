const getSearchTerms = (query: string): readonly string[] =>
  query.trim().toLowerCase().split(/\s+/).filter(Boolean);

const matchesSearchTerms = (haystack: string, terms: readonly string[]): boolean =>
  terms.every((term) => haystack.includes(term));

export { getSearchTerms, matchesSearchTerms };
