/**
 * Text normalisation shared by search, the anagram solver and the cipher
 * decoder.
 *
 * OSRS names are hostile to naive string comparison. They contain apostrophes
 * (`Wydin's Food Store`), hyphens (`Ur-tag`), full stops and mixed case, and
 * players type none of that into a search box. Every comparison in this feature
 * therefore goes through one of the functions below rather than `===`.
 *
 * There are two different normalisations here and conflating them is a bug:
 * `normaliseForSearch` keeps word boundaries (so `"party pete"` matches), while
 * `lettersOnly` destroys them (so `"PEATY PERT"` can be compared to
 * `"Party Pete"` as a bag of letters).
 */

/**
 * Lowercases, strips punctuation, and collapses whitespace to single spaces.
 *
 * **Apostrophes are deleted; every other separator becomes a space.** The
 * distinction is not fussiness — it is the difference between a search box that
 * works and one that does not, and it was caught by a test rather than by
 * reasoning:
 *
 *   - An apostrophe sits *inside* a word. `"Wydin's"` must normalise to
 *     `"wydins"`, because a player types `wydins food` without one. Turning it
 *     into a space gives `"wydin s food"`, which that query cannot match.
 *   - A hyphen *separates* words. `"Ur-tag"` must normalise to `"ur tag"` so it
 *     matches both `ur tag` and `ur-tag`. Deleting it gives `"urtag"`, which
 *     matches neither.
 *
 * Curly apostrophes are included: players paste clue text out of the Wiki,
 * which uses them, and a straight-quote-only rule would silently fail on
 * exactly the queries most likely to be pasted rather than typed.
 */
export function normaliseForSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Reduces a string to its lowercase letters, discarding everything else.
 *
 * Used by both derivable solvers. Digits go too: no NPC name contains one, and
 * keeping them would make a stray typed number silently prevent every match.
 */
export function lettersOnly(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Substring match after normalising both sides.
 *
 * Partial by design — a player who half-remembers `"zoo"` should find
 * `"Zoo keeper"`. Requiring a whole-word or prefix match here would make the
 * search feel broken on exactly the queries people actually type.
 */
export function matchesQuery(haystack: string, query: string): boolean {
  const needle = normaliseForSearch(query);
  if (needle === '') return false;
  return normaliseForSearch(haystack).includes(needle);
}
