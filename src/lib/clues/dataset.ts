import type { ClueStep } from './types';

/**
 * Catalogued clue steps — **deliberately partial**. See ADR-0017.
 *
 * The full Treasure Trails corpus runs to thousands of steps across six tiers,
 * and transcribing it is the single largest content-authoring task in this
 * product (PRD §3.4). This file does not attempt it. What ships is a coherent,
 * verifiable subset over a working search mechanism, sized so that every entry
 * can be checked rather than trusted.
 *
 * ## The important consequence
 *
 * Because anagram and cipher steps are solved *algorithmically* from
 * `npc-index.ts`, the entries below are not what bounds those two types — the
 * solvers answer anagrams and ciphers that appear nowhere in this file. The
 * anagram entries here exist to give the search box something to match on and,
 * usefully, to act as a **self-check**: `dataset.test.ts` asserts that every
 * anagram's letters really are its answer's letters, so a typo fails the build
 * rather than shipping a wrong answer.
 *
 * ## Adding steps
 *
 * 1. `id` must be unique and stable — it is a candidate deep link.
 * 2. Quote the scroll text as the game words it.
 * 3. `wikiPage` must be a page that actually confirms the entry. Nothing here
 *    is copied from a third-party dataset (ADR-0007); entries are written from
 *    the public game and each carries a pointer for verification.
 * 4. Run `npm run check` — the integrity test catches duplicate ids, missing
 *    fields, unknown answers and bad anagrams.
 *
 * `emote`, `map`, `coordinate` and `puzzle` steps are **not covered at all**
 * yet. That is stated in the UI rather than left for a member to discover by
 * getting no results.
 */
export const CLUE_STEPS: readonly ClueStep[] = [
  /* --- Anagrams ------------------------------------------------------------
   * Every entry below is also solvable by `solveAnagram` without being listed,
   * because its answer is in the name index. */
  {
    id: 'anagram-ok-co',
    type: 'anagram',
    tiers: ['beginner'],
    clue: 'OK CO',
    answer: 'Cook',
    solution: 'Talk to the Cook in the Lumbridge Castle kitchen.',
    wikiPage: 'Cook',
  },
  {
    id: 'anagram-an-earl',
    type: 'anagram',
    tiers: ['beginner'],
    clue: 'AN EARL',
    answer: 'Ranael',
    solution: "Talk to Ranael in Ranael's Super Skirt Store, Al Kharid.",
    wikiPage: 'Ranael',
  },
  {
    id: 'anagram-me-if',
    type: 'anagram',
    tiers: ['easy'],
    clue: 'ME IF',
    answer: 'Femi',
    solution: 'Talk to Femi outside the Tree Gnome Stronghold gate.',
    wikiPage: 'Femi',
  },
  {
    id: 'anagram-el-ow',
    type: 'anagram',
    tiers: ['easy'],
    clue: 'EL OW',
    answer: 'Lowe',
    solution: "Talk to Lowe in Lowe's Archery Emporium, Varrock.",
    wikiPage: 'Lowe',
  },
  {
    id: 'anagram-r-ak-mi',
    type: 'anagram',
    tiers: ['easy'],
    clue: 'R AK MI',
    answer: 'Karim',
    solution: 'Talk to Karim in the Al Kharid kebab shop.',
    wikiPage: 'Karim',
  },
  {
    id: 'anagram-halt-us',
    type: 'anagram',
    tiers: ['easy'],
    clue: 'HALT US',
    answer: 'Luthas',
    solution: 'Talk to Luthas at the banana plantation on Musa Point, Karamja.',
    wikiPage: 'Luthas',
  },
  {
    id: 'anagram-by-look',
    type: 'anagram',
    tiers: ['easy'],
    clue: 'BY LOOK',
    answer: 'Bolkoy',
    solution: 'Talk to Bolkoy in the Tree Gnome Village general store.',
    wikiPage: 'Bolkoy',
  },
  {
    id: 'anagram-are-col',
    type: 'anagram',
    tiers: ['easy'],
    clue: 'ARE COL',
    answer: 'Oracle',
    solution: 'Talk to the Oracle on top of Ice Mountain.',
    wikiPage: 'Oracle',
  },
  {
    id: 'anagram-kay-sir',
    type: 'anagram',
    tiers: ['easy'],
    clue: 'KAY SIR',
    answer: 'Sir Kay',
    solution: 'Talk to Sir Kay in the Camelot Castle courtyard.',
    wikiPage: 'Sir Kay',
  },
  {
    id: 'anagram-got-a-boy',
    type: 'anagram',
    tiers: ['easy'],
    clue: 'GOT A BOY',
    answer: 'Gabooty',
    solution: 'Talk to Gabooty in Tai Bwo Wannai.',
    wikiPage: 'Gabooty',
  },
  {
    id: 'anagram-peaty-pert',
    type: 'anagram',
    tiers: ['easy'],
    clue: 'PEATY PERT',
    answer: 'Party Pete',
    solution: 'Talk to Party Pete in the Falador Party Room.',
    wikiPage: 'Party Pete',
  },
  {
    id: 'anagram-carpet-ahoy',
    type: 'anagram',
    tiers: ['easy'],
    clue: 'CARPET AHOY',
    answer: 'Apothecary',
    solution: 'Talk to the Apothecary in south-west Varrock.',
    wikiPage: 'Apothecary',
  },
  {
    id: 'anagram-bail-trims',
    type: 'anagram',
    tiers: ['easy'],
    clue: 'BAIL TRIMS',
    answer: 'Brimstail',
    solution:
      'Talk to Brimstail in his cave in the south-west of the Tree Gnome Stronghold.',
    wikiPage: 'Brimstail',
  },
  {
    id: 'anagram-eek-zero-op',
    type: 'anagram',
    tiers: ['easy'],
    clue: 'EEK ZERO OP',
    answer: 'Zoo keeper',
    solution: 'Talk to the Zoo keeper at Ardougne Zoo.',
    wikiPage: 'Zoo keeper',
  },
  {
    id: 'anagram-lark-in-dog',
    type: 'anagram',
    tiers: ['easy'],
    clue: 'LARK IN DOG',
    answer: 'King Roald',
    solution: 'Talk to King Roald in Varrock Palace.',
    wikiPage: 'King Roald',
  },
  {
    id: 'anagram-dr-warden-funk',
    type: 'anagram',
    tiers: ['easy'],
    clue: 'DR WARDEN FUNK',
    answer: 'Drunken Dwarf',
    solution: 'Talk to the Drunken Dwarf in Keldagrim.',
    wikiPage: 'Drunken Dwarf',
  },
  {
    id: 'anagram-aha-jar',
    type: 'anagram',
    tiers: ['medium'],
    clue: 'AHA JAR',
    answer: 'Jaraah',
    solution: 'Talk to Jaraah in the hospital east of Al Kharid.',
    wikiPage: 'Jaraah',
  },
  {
    id: 'anagram-ded-war',
    type: 'anagram',
    tiers: ['medium'],
    clue: 'DED WAR',
    answer: 'Edward',
    solution: 'Talk to Edward in Varrock Palace.',
    wikiPage: 'Edward',
  },

  /* --- Cryptics ------------------------------------------------------------
   * No algorithm helps here. Every cryptic is authored prose, which is why the
   * full corpus is a content project rather than a code one. */
  {
    id: 'cryptic-hans',
    type: 'cryptic',
    tiers: ['beginner'],
    clue: 'Speak to Hans to solve the clue.',
    answer: 'Hans',
    solution: 'Hans wanders the Lumbridge Castle courtyard. Talk to him.',
    wikiPage: 'Hans',
  },
  {
    id: 'cryptic-doomsayer',
    type: 'cryptic',
    tiers: ['beginner'],
    clue: 'Talk to the Doomsayer.',
    answer: 'Doomsayer',
    solution: 'The Doomsayer stands on the ground floor of Lumbridge Castle.',
    wikiPage: 'Doomsayer',
  },
  {
    id: 'cryptic-ned',
    type: 'cryptic',
    tiers: ['beginner'],
    clue: 'Talk to Ned in Draynor Village.',
    answer: 'Ned',
    solution: 'Ned is in his house in the north-west of Draynor Village.',
    wikiPage: 'Ned',
  },
  {
    id: 'cryptic-charlie',
    type: 'cryptic',
    tiers: ['beginner'],
    clue: 'Talk to Charlie the Tramp in Varrock.',
    answer: 'Charlie the Tramp',
    solution: 'Charlie sits by the south entrance to Varrock.',
    wikiPage: 'Charlie the Tramp',
  },
  {
    id: 'cryptic-sarah',
    type: 'cryptic',
    tiers: ['beginner'],
    clue: 'Speak to Sarah at Falador farm.',
    answer: 'Sarah',
    solution: 'Sarah runs the farming shop at Falador farm, north of Falador.',
    wikiPage: 'Sarah',
  },
  {
    id: 'cryptic-zeke',
    type: 'cryptic',
    tiers: ['beginner'],
    clue: 'Talk to Zeke in Al Kharid.',
    answer: 'Zeke',
    solution: "Zeke runs Zeke's Superior Scimitars, in the north of Al Kharid.",
    wikiPage: 'Zeke',
  },
  {
    id: 'cryptic-rusty-anchor',
    type: 'cryptic',
    tiers: ['easy'],
    clue: 'Speak to the bartender of the Rusty Anchor in Port Sarim.',
    answer: 'Bartender',
    solution: 'The Rusty Anchor is in the north of Port Sarim. Talk to the bartender.',
    wikiPage: 'Rusty Anchor',
  },
  {
    id: 'cryptic-blue-moon',
    type: 'cryptic',
    tiers: ['easy'],
    clue: 'Speak to the bartender of the Blue Moon Inn in Varrock.',
    answer: 'Bartender',
    solution: 'The Blue Moon Inn is in south-central Varrock. Talk to the bartender.',
    wikiPage: 'Blue Moon Inn',
  },
  {
    id: 'cryptic-rising-sun',
    type: 'cryptic',
    tiers: ['easy'],
    clue: 'Speak to the bartender of the Rising Sun in Falador.',
    answer: 'Emily',
    solution:
      'Emily tends the bar at the Rising Sun Inn, north of the Falador west bank.',
    wikiPage: 'Emily',
  },
  {
    id: 'cryptic-ellis',
    type: 'cryptic',
    tiers: ['easy'],
    clue: 'Talk to Ellis in Al Kharid.',
    answer: 'Ellis',
    solution: 'Ellis runs the tannery in the north-west of Al Kharid.',
    wikiPage: 'Ellis',
  },
  {
    id: 'cryptic-hazelmere',
    type: 'cryptic',
    tiers: ['hard'],
    clue: 'Talk to Hazelmere.',
    answer: 'Hazelmere',
    solution: 'Hazelmere lives upstairs in the hut on the island east of Yanille.',
    wikiPage: 'Hazelmere',
  },
];

/**
 * Types with no catalogued steps and no solver, stated explicitly.
 *
 * Kept as data rather than prose so the UI cannot drift out of step with the
 * dataset — the filter, the coverage notice and the empty state all read this.
 */
export const UNCOVERED_CLUE_TYPES = ['emote', 'map', 'coordinate', 'puzzle'] as const;
