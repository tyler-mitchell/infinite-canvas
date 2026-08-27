/**
 * What counts as a match, for every search box in the app.
 *
 * There are two — the command palette and the library rail — and they had this rule written out
 * separately: split the query on whitespace, lowercase it, and require every term to appear as a
 * substring. Same rule, two files, two test suites, and nothing holding them together.
 *
 * That matters because they are the same gesture to the person using them. Someone who learns that
 * a second word narrows the list in one box expects it in the other, and the first change to either
 * rule — quoted phrases, folding diacritics, matching word starts only — would have made them
 * disagree with no way to notice except by typing the same thing into both.
 *
 * Ranking is deliberately not here. The palette scores by earliest match because it shows one list
 * ordered by relevance; the rail filters a browsable tree where order is the library's own. Those
 * are different jobs, and only the question "does this match" is shared.
 */

/**
 * A typed query as terms.
 *
 * Whitespace-separated, so a second word narrows rather than widens — which a bare `includes` of
 * the raw query cannot do, since that demands the words in the typed order and adjacent.
 */
const getSearchTerms = (query: string): readonly string[] =>
  query.trim().toLowerCase().split(/\s+/).filter(Boolean);

/**
 * Every term, not any, and substrings rather than subsequences.
 *
 * The subsequence form is what `cmdk` does by default and it was measurably wrong here: "undo"
 * surfaced "Nudge Left", "Dock Up" and "Focus Down" — every label containing u, n, d, o in that
 * order. Requiring each term whole costs nothing and stops the list arguing with you.
 *
 * The haystack is lowercased by the caller, since both callers already hold a folded string and
 * folding it again per term would be work for nothing.
 */
const matchesSearchTerms = (haystack: string, terms: readonly string[]): boolean =>
  terms.every((term) => haystack.includes(term));

export { getSearchTerms, matchesSearchTerms };
