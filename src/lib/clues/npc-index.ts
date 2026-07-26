import type { ClueTarget } from './types';

/**
 * The solver dictionary — names an anagram or cipher can resolve to.
 *
 * ⚠️ THIS FILE, NOT `dataset.ts`, IS WHERE COVERAGE COMES FROM.
 *
 * Anagram and cipher steps are mechanically derivable: the scroll text is a
 * scrambled or Caesar-shifted name, so a solver that owns a list of names can
 * answer a step nobody has ever catalogued. Adding one entry here can therefore
 * unlock several steps at once, across every tier, for a fraction of the effort
 * of writing them out. (ADR-0017)
 *
 * ## Adding entries
 *
 * - **Spell the name exactly as the game does**, apostrophes and all. The
 *   solvers normalise before comparing, so capitalisation is forgiving, but the
 *   name is displayed verbatim.
 * - **Omit `location` unless you are certain.** A wrong location sends someone
 *   on a five-minute run to the wrong city, which is worse than the UI saying
 *   "location not catalogued". Absence is handled; wrongness is not detectable.
 * - **Every entry is verifiable** against the linked wiki page. Nothing here is
 *   copied from another project's dataset (ADR-0007) — these are names from a
 *   public game, each with a pointer to the Wiki page that confirms it.
 *
 * A future contribution could populate this from `Bucket:Infobox npc`, which
 * has `npc_name` and `location` fields (verified 2026-07-26). That is a real
 * option and is discussed in ADR-0017; it is not done here because it would put
 * a build-time network dependency behind the one page that currently needs
 * none.
 */
export const CLUE_TARGETS: readonly ClueTarget[] = [
  /* --- Lumbridge & Draynor ------------------------------------------------ */
  { name: 'Hans', location: 'Lumbridge Castle courtyard' },
  { name: 'Cook', location: 'Lumbridge Castle kitchen' },
  { name: 'Bob', location: "Bob's Brilliant Axes, Lumbridge" },
  { name: 'Father Aereck', location: 'Lumbridge church' },
  { name: 'Father Urhney', location: 'Lumbridge Swamp, west' },
  { name: 'Doomsayer', location: 'Lumbridge Castle, ground floor' },
  { name: 'Explorer Jack', location: 'Lumbridge, west of the castle' },
  { name: 'Fred the Farmer', location: 'North of Lumbridge' },
  { name: 'Ned', location: 'Draynor Village' },
  { name: 'Morgan', location: 'Draynor Village' },
  { name: 'Aggie', location: 'Draynor Village' },
  { name: 'Wise Old Man', location: 'Draynor Village' },
  { name: 'Martin the Master Gardener', location: 'Draynor Village farm' },

  /* --- Varrock ------------------------------------------------------------ */
  { name: 'King Roald', location: 'Varrock Palace' },
  { name: 'Reldo', location: 'Varrock Palace library' },
  { name: 'Aubury', location: "Aubury's Rune Shop, south-east Varrock" },
  { name: 'Baraek', location: 'Varrock square' },
  { name: 'Horvik', location: "Horvik's Armour Shop, Varrock" },
  { name: 'Thessalia', location: "Thessalia's Fine Clothes, Varrock" },
  { name: 'Zaff', location: "Zaff's Superior Staffs, Varrock" },
  { name: 'Lowe', location: "Lowe's Archery Emporium, Varrock" },
  { name: 'Apothecary', location: 'South-west Varrock' },
  { name: 'Charlie the Tramp', location: 'Varrock, south entrance' },
  { name: 'Gertrude', location: 'West of Varrock' },
  { name: 'Edward', location: 'Varrock Palace' },

  /* --- Falador & Asgarnia ------------------------------------------------- */
  { name: 'Party Pete', location: 'Falador Party Room' },
  { name: 'Sir Vyvin', location: "White Knights' Castle, Falador" },
  { name: 'Sir Amik Varze', location: "White Knights' Castle, Falador" },
  { name: 'Ambassador Spanfipple', location: "White Knights' Castle, Falador" },
  { name: 'Cassie', location: "Cassie's Shield Shop, Falador" },
  { name: 'Herquin', location: "Herquin's Gems, Falador" },
  { name: 'Flynn', location: "Flynn's Mace Market, Falador" },
  { name: 'Wayne', location: "Wayne's Chains, Falador" },
  { name: 'Emily', location: 'Rising Sun Inn, Falador' },
  { name: 'Kaylee', location: 'Rising Sun Inn, Falador' },
  { name: 'Sarah', location: 'Falador farm, north of Falador' },
  { name: 'Doric', location: "Doric's anvil, north of Falador" },
  { name: 'Nurmof', location: 'Dwarven Mine' },
  { name: 'Thurgo', location: 'South of Port Sarim' },
  { name: 'Oziach', location: 'Edgeville' },
  { name: 'Sedridor', location: "Wizards' Tower basement" },

  /* --- Port Sarim & Rimmington -------------------------------------------- */
  { name: 'Betty', location: "Betty's Magic Emporium, Port Sarim" },
  { name: 'Grum', location: "Grum's Gold Exchange, Port Sarim" },
  { name: 'Wydin', location: "Wydin's Food Store, Port Sarim" },
  { name: 'Brian', location: "Brian's Battleaxe Bazaar, Port Sarim" },
  { name: 'Gerrant', location: "Gerrant's Fishy Business, Port Sarim" },
  { name: 'Hetty', location: 'Rimmington' },

  /* --- Al Kharid & the desert --------------------------------------------- */
  { name: 'Ranael', location: "Ranael's Super Skirt Store, Al Kharid" },
  { name: 'Karim', location: 'Al Kharid kebab shop' },
  { name: 'Zeke', location: "Zeke's Superior Scimitars, Al Kharid" },
  { name: 'Ellis', location: 'Al Kharid tannery' },
  { name: 'Ali Morrisane', location: 'Al Kharid' },
  { name: 'Shantay', location: 'Shantay Pass, south of Al Kharid' },
  { name: 'Jaraah', location: 'Hospital, east of Al Kharid' },

  /* --- Taverley, Burthorpe & the mountains -------------------------------- */
  { name: 'Sanfew', location: 'Taverley' },
  { name: 'Kaqemeex', location: 'Taverley stone circle' },
  { name: 'Jatix', location: "Jatix's Herblore Shop, Taverley" },
  { name: 'Gaius', location: "Gaius' Two Handed Shop, Burthorpe" },
  { name: 'Turael', location: 'Burthorpe' },
  { name: 'Oracle', location: 'Ice Mountain' },
  { name: 'Drunken Dwarf', location: 'Keldagrim' },

  /* --- Catherby, Seers' & Camelot ----------------------------------------- */
  { name: 'Sir Kay', location: 'Camelot Castle' },
  { name: 'Arhein', location: 'Catherby' },
  { name: 'Harry', location: "Harry's Fishing Shop, Catherby" },
  { name: 'Hickton', location: "Hickton's Archery Emporium, Catherby" },
  { name: 'Candlemaker', location: 'Catherby' },
  { name: 'Rasolo', location: 'West of the Fishing Guild' },

  /* --- Gnome lands -------------------------------------------------------- */
  { name: 'Brimstail', location: 'Tree Gnome Stronghold, south-west cave' },
  { name: 'Femi', location: 'Tree Gnome Stronghold gate' },
  { name: 'King Bolren', location: 'Tree Gnome Village centre' },
  { name: 'Bolkoy', location: 'Tree Gnome Village general store' },
  { name: 'Nieve', location: 'Tree Gnome Stronghold' },
  { name: 'Hazelmere', location: 'Island east of Yanille' },

  /* --- Ardougne & Kandarin ------------------------------------------------ */
  { name: 'Zoo keeper', location: 'Ardougne Zoo' },
  { name: 'Wizard Cromperty', location: 'North-east East Ardougne' },
  { name: 'Wizard Distentor', location: "Wizards' Guild, Yanille" },

  /* --- Karamja ------------------------------------------------------------ */
  { name: 'Luthas', location: 'Banana plantation, Musa Point' },
  { name: 'Hajedy', location: 'Brimhaven, near the cart' },
  { name: 'Gabooty', location: 'Tai Bwo Wannai' },
  { name: 'Duradel', location: 'Shilo Village' },

  /* --- Morytania ---------------------------------------------------------- */
  { name: 'Ulizius', location: 'Mort Myre gate' },
  { name: 'Roavar', location: 'Canifis tavern' },
  { name: 'Mazchna', location: 'Canifis' },

  /* --- Elsewhere ---------------------------------------------------------- */
  { name: 'Vannaka', location: 'Edgeville Dungeon' },
  { name: 'Chaeldar', location: 'Zanaris' },
  // No `location`: there is a bartender in most inns in the game, so any single
  // location we picked would be wrong for most clues that answer "Bartender".
  // This is the case the optional field exists for.
  { name: 'Bartender' },
];

/** Wiki page for a target — defaults to the name, which is usually the page. */
export function wikiPageFor(target: ClueTarget): string {
  return target.wikiPage ?? target.name;
}

export function wikiUrlFor(pageTitle: string): string {
  return `https://oldschool.runescape.wiki/w/${encodeURIComponent(pageTitle.replaceAll(' ', '_'))}`;
}
