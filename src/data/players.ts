import type { Player } from "../bracket/types";

/* ----------------------------------------------------------------------------
   Player -> { name, iso, shortCode, seed } lookup (BUILD-BLUEPRINT §9).

   ILLUSTRATIVE PLACEHOLDER for the 2026 Championships (URS-40, URS-69): a
   plausible set of real, currently-active players assigned to a fictional R32
   seeding line for demonstration purposes only. This is NOT a claim about the
   real 2026 draw, seeding, or entry list. Swap this file (keeping the `id`
   keys used by the draw JSONs) to load real 2026 data (URS-31).

   iso = ISO 3166-1 alpha-2 (lower-case) for flagcdn (URS-20).
   shortCode = 3-letter code for feeder labels + token badge (URS-9, URS-21).
---------------------------------------------------------------------------- */

export const GENTLEMENS_PLAYERS: Player[] = [
  { id: "g-alcaraz", name: "Carlos Alcaraz", iso: "es", shortCode: "ALC", seed: 1 },
  { id: "g-shelton", name: "Ben Shelton", iso: "us", shortCode: "SHE", seed: 17 },
  { id: "g-rune", name: "Holger Rune", iso: "dk", shortCode: "RUN", seed: 12 },
  { id: "g-humbert", name: "Ugo Humbert", iso: "fr", shortCode: "HUM", seed: 22 },
  { id: "g-tiafoe", name: "Frances Tiafoe", iso: "us", shortCode: "TIA", seed: 15 },
  { id: "g-fritz", name: "Taylor Fritz", iso: "us", shortCode: "FRI", seed: 5 },
  { id: "g-paul", name: "Tommy Paul", iso: "us", shortCode: "PAU", seed: 13 },
  { id: "g-djokovic", name: "Novak Djokovic", iso: "rs", shortCode: "DJO", seed: 4 },
  { id: "g-sinner", name: "Jannik Sinner", iso: "it", shortCode: "SIN", seed: 2 },
  { id: "g-de-minaur", name: "Alex de Minaur", iso: "au", shortCode: "DEM", seed: 9 },
  { id: "g-dimitrov", name: "Grigor Dimitrov", iso: "bg", shortCode: "DIM", seed: 16 },
  { id: "g-rublev", name: "Andrey Rublev", iso: "ru", shortCode: "RUB", seed: 8 },
  { id: "g-tsitsipas", name: "Stefanos Tsitsipas", iso: "gr", shortCode: "TSI", seed: 11 },
  { id: "g-medvedev", name: "Daniil Medvedev", iso: "ru", shortCode: "MED", seed: 6 },
  { id: "g-hurkacz", name: "Hubert Hurkacz", iso: "pl", shortCode: "HUR", seed: 14 },
  { id: "g-zverev", name: "Alexander Zverev", iso: "de", shortCode: "ZVE", seed: 3 },
  { id: "g-draper", name: "Jack Draper", iso: "gb", shortCode: "DRA", seed: 7 },
  { id: "g-korda", name: "Sebastian Korda", iso: "us", shortCode: "KOR", seed: 21 },
  { id: "g-machac", name: "Tomas Machac", iso: "cz", shortCode: "MAC", seed: 27 },
  { id: "g-mensik", name: "Jakub Mensik", iso: "cz", shortCode: "MEN", seed: 19 },
  { id: "g-lehecka", name: "Jiri Lehecka", iso: "cz", shortCode: "LEH", seed: 24 },
  { id: "g-berrettini", name: "Matteo Berrettini", iso: "it", shortCode: "BER", seed: 26 },
  { id: "g-thompson", name: "Jordan Thompson", iso: "au", shortCode: "THO", seed: 29 },
  { id: "g-ruud", name: "Casper Ruud", iso: "no", shortCode: "RUU", seed: 10 },
  { id: "g-musetti", name: "Lorenzo Musetti", iso: "it", shortCode: "MUS", seed: 18 },
  { id: "g-shapovalov", name: "Denis Shapovalov", iso: "ca", shortCode: "SHA", seed: 25 },
  { id: "g-popyrin", name: "Alexei Popyrin", iso: "au", shortCode: "POP", seed: 28 },
  { id: "g-monfils", name: "Gael Monfils", iso: "fr", shortCode: "MON", seed: 31 },
  { id: "g-cerundolo", name: "Francisco Cerundolo", iso: "ar", shortCode: "CER", seed: 23 },
  { id: "g-fils", name: "Arthur Fils", iso: "fr", shortCode: "FIL", seed: 20 },
  { id: "g-nakashima", name: "Brandon Nakashima", iso: "us", shortCode: "NAK", seed: 30 },
  { id: "g-norrie", name: "Cameron Norrie", iso: "gb", shortCode: "NOR", seed: 32 },
];

export const LADIES_PLAYERS: Player[] = [
  { id: "l-swiatek", name: "Iga Swiatek", iso: "pl", shortCode: "SWI", seed: 1 },
  { id: "l-krejcikova", name: "Barbora Krejcikova", iso: "cz", shortCode: "KRE", seed: 17 },
  { id: "l-pegula", name: "Jessica Pegula", iso: "us", shortCode: "PEG", seed: 5 },
  { id: "l-navarro", name: "Emma Navarro", iso: "us", shortCode: "NAV", seed: 12 },
  { id: "l-paolini", name: "Jasmine Paolini", iso: "it", shortCode: "PAO", seed: 4 },
  { id: "l-keys", name: "Madison Keys", iso: "us", shortCode: "KEY", seed: 9 },
  { id: "l-svitolina", name: "Elina Svitolina", iso: "ua", shortCode: "SVI", seed: 20 },
  { id: "l-sabalenka", name: "Aryna Sabalenka", iso: "by", shortCode: "SAB", seed: 2 },
  { id: "l-gauff", name: "Coco Gauff", iso: "us", shortCode: "GAU", seed: 3 },
  { id: "l-vondrousova", name: "Marketa Vondrousova", iso: "cz", shortCode: "VON", seed: 15 },
  { id: "l-badosa", name: "Paula Badosa", iso: "es", shortCode: "BAD", seed: 11 },
  { id: "l-collins", name: "Danielle Collins", iso: "us", shortCode: "COL", seed: 22 },
  { id: "l-zheng", name: "Zheng Qinwen", iso: "cn", shortCode: "ZHE", seed: 7 },
  { id: "l-rybakina", name: "Elena Rybakina", iso: "kz", shortCode: "RYB", seed: 6 },
  { id: "l-muchova", name: "Karolina Muchova", iso: "cz", shortCode: "MUC", seed: 14 },
  { id: "l-jabeur", name: "Ons Jabeur", iso: "tn", shortCode: "JAB", seed: 16 },
  { id: "l-alexandrova", name: "Ekaterina Alexandrova", iso: "ru", shortCode: "ALE", seed: 8 },
  { id: "l-samsonova", name: "Liudmila Samsonova", iso: "ru", shortCode: "SAM", seed: 21 },
  { id: "l-kalinskaya", name: "Anna Kalinskaya", iso: "ru", shortCode: "KAL", seed: 26 },
  { id: "l-fernandez", name: "Leylah Fernandez", iso: "ca", shortCode: "FER", seed: 28 },
  { id: "l-haddad-maia", name: "Beatriz Haddad Maia", iso: "br", shortCode: "HAD", seed: 19 },
  { id: "l-kostyuk", name: "Marta Kostyuk", iso: "ua", shortCode: "KOS", seed: 23 },
  { id: "l-cirstea", name: "Sorana Cirstea", iso: "ro", shortCode: "CIR", seed: 30 },
  { id: "l-ostapenko", name: "Jelena Ostapenko", iso: "lv", shortCode: "OST", seed: 10 },
  { id: "l-linette", name: "Magda Linette", iso: "pl", shortCode: "LIN", seed: 18 },
  { id: "l-anisimova", name: "Amanda Anisimova", iso: "us", shortCode: "ANI", seed: 25 },
  { id: "l-tomljanovic", name: "Ajla Tomljanovic", iso: "au", shortCode: "TOM", seed: 29 },
  { id: "l-mertens", name: "Elise Mertens", iso: "be", shortCode: "MER", seed: 31 },
  { id: "l-parry", name: "Diane Parry", iso: "fr", shortCode: "PAR", seed: 24 },
  { id: "l-frech", name: "Magdalena Frech", iso: "pl", shortCode: "FRE", seed: 27 },
  { id: "l-siegemund", name: "Laura Siegemund", iso: "de", shortCode: "SIE", seed: 32 },
  { id: "l-bouzkova", name: "Marie Bouzkova", iso: "cz", shortCode: "BOU", seed: 13 },
];

export const ALL_PLAYERS: Player[] = [...GENTLEMENS_PLAYERS, ...LADIES_PLAYERS];

export const PLAYERS_BY_ID: Record<string, Player> = Object.fromEntries(
  ALL_PLAYERS.map((p) => [p.id, p]),
);

export function playerById(id?: string | null): Player | undefined {
  if (!id) return undefined;
  return PLAYERS_BY_ID[id];
}
