import type { Player } from "../bracket/types";

/* ----------------------------------------------------------------------------
   Player -> { name, iso, shortCode, seed } lookup (BUILD-BLUEPRINT §9).

   REAL 2026 Championships data (URS-31 refresh, live snapshot as of Day 7,
   Sunday 5 July 2026): the 32 players who reached the Round of 32 (third
   round) in each draw, with their actual seed (where seeded) and nationality.
   Cross-checked against Wikipedia's 2026 Wimbledon seeds tables, Sky Sports'
   men's/women's draw-and-results articles, the ATP/WTA tour sites, and CBS
   Sports' round-of-16 bracket breakdown (see project CLAUDE.md "Swapping in
   real 2026 data"). Unseeded R32 players (qualifiers, wildcards, or seeds
   outside the top 32) carry no `seed` field, matching the data model.

   iso = ISO 3166-1 alpha-2 (lower-case) for flagcdn (URS-20).
   shortCode = 3-letter code for feeder labels + token badge (URS-9, URS-21).
---------------------------------------------------------------------------- */

export const GENTLEMENS_PLAYERS: Player[] = [
  // -- Top half --
  { id: "g-sinner", name: "Jannik Sinner", iso: "it", shortCode: "SIN", seed: 1 },
  { id: "g-mochizuki", name: "Shintaro Mochizuki", iso: "jp", shortCode: "MOC" },
  { id: "g-hurkacz", name: "Hubert Hurkacz", iso: "pl", shortCode: "HUR" },
  { id: "g-struff", name: "Jan-Lennard Struff", iso: "de", shortCode: "STR" },
  { id: "g-auger-aliassime", name: "Felix Auger-Aliassime", iso: "ca", shortCode: "FAA", seed: 3 },
  {
    id: "g-davidovich-fokina",
    name: "Alejandro Davidovich Fokina",
    iso: "es",
    shortCode: "ADF",
    seed: 22,
  },
  { id: "g-djokovic", name: "Novak Djokovic", iso: "rs", shortCode: "DJO", seed: 7 },
  { id: "g-safiullin", name: "Roman Safiullin", iso: "ru", shortCode: "SAF" },
  // -- Bottom half --
  { id: "g-de-minaur", name: "Alex de Minaur", iso: "au", shortCode: "DEM", seed: 5 },
  { id: "g-cobolli", name: "Flavio Cobolli", iso: "it", shortCode: "COB", seed: 9 },
  { id: "g-dimitrov", name: "Grigor Dimitrov", iso: "bg", shortCode: "DIM" },
  { id: "g-fery", name: "Arthur Fery", iso: "gb", shortCode: "FER" },
  { id: "g-fritz", name: "Taylor Fritz", iso: "us", shortCode: "FRI", seed: 6 },
  { id: "g-bublik", name: "Alexander Bublik", iso: "kz", shortCode: "BUB", seed: 10 },
  { id: "g-zverev", name: "Alexander Zverev", iso: "de", shortCode: "ZVE", seed: 2 },
  { id: "g-lehecka", name: "Jiri Lehecka", iso: "cz", shortCode: "LEH", seed: 13 },
  // -- Unseeded/seeded R32 players eliminated in that round (kept for R32 pairing/history) --
  { id: "g-brooksby", name: "Jenson Brooksby", iso: "us", shortCode: "BRO" },
  { id: "g-jodar", name: "Rafael Jodar", iso: "es", shortCode: "JOD", seed: 23 },
  { id: "g-paul", name: "Tommy Paul", iso: "us", shortCode: "PAU", seed: 21 },
  { id: "g-medvedev", name: "Daniil Medvedev", iso: "ru", shortCode: "MED", seed: 8 },
  { id: "g-zheng-michael", name: "Michael Zheng", iso: "us", shortCode: "ZHM" },
  { id: "g-fucsovics", name: "Marton Fucsovics", iso: "hu", shortCode: "FUC" },
  { id: "g-fonseca", name: "Joao Fonseca", iso: "br", shortCode: "FON", seed: 24 },
  { id: "g-rinderknech", name: "Arthur Rinderknech", iso: "fr", shortCode: "RIN", seed: 25 },
  { id: "g-svajda", name: "Zachary Svajda", iso: "us", shortCode: "SVA" },
  { id: "g-khachanov", name: "Karen Khachanov", iso: "ru", shortCode: "KHA", seed: 19 },
  { id: "g-berrettini", name: "Matteo Berrettini", iso: "it", shortCode: "BER" },
  { id: "g-bergs", name: "Zizou Bergs", iso: "be", shortCode: "BEG" },
  { id: "g-sonego", name: "Lorenzo Sonego", iso: "it", shortCode: "SON" },
  { id: "g-tiafoe", name: "Frances Tiafoe", iso: "us", shortCode: "TIA", seed: 17 },
  { id: "g-munar", name: "Jaume Munar", iso: "es", shortCode: "MUN" },
  { id: "g-giron", name: "Marcos Giron", iso: "us", shortCode: "GIR" },
];

export const LADIES_PLAYERS: Player[] = [
  // -- Top half --
  { id: "l-sabalenka", name: "Aryna Sabalenka", iso: "by", shortCode: "SAB", seed: 1 },
  { id: "l-osaka", name: "Naomi Osaka", iso: "jp", shortCode: "OSA", seed: 14 },
  { id: "l-muchova", name: "Karolina Muchova", iso: "cz", shortCode: "MUC", seed: 10 },
  { id: "l-krejcikova", name: "Barbora Krejcikova", iso: "cz", shortCode: "KRE" },
  { id: "l-pegula", name: "Jessica Pegula", iso: "us", shortCode: "PEG", seed: 4 },
  { id: "l-jovic", name: "Iva Jovic", iso: "us", shortCode: "JOV", seed: 16 },
  { id: "l-bencic", name: "Belinda Bencic", iso: "ch", shortCode: "BEN", seed: 11 },
  { id: "l-gauff", name: "Coco Gauff", iso: "us", shortCode: "GAU", seed: 7 },
  // -- Bottom half --
  { id: "l-krueger", name: "Ashlyn Krueger", iso: "us", shortCode: "KRU" },
  { id: "l-kostyuk", name: "Marta Kostyuk", iso: "ua", shortCode: "KOS", seed: 12 },
  { id: "l-paolini", name: "Jasmine Paolini", iso: "it", shortCode: "PAO", seed: 13 },
  { id: "l-eala", name: "Alexandra Eala", iso: "ph", shortCode: "EAL", seed: 29 },
  { id: "l-keys", name: "Madison Keys", iso: "us", shortCode: "KEY", seed: 26 },
  { id: "l-noskova", name: "Linda Noskova", iso: "cz", shortCode: "NOS", seed: 9 },
  { id: "l-bouzkova", name: "Marie Bouzkova", iso: "cz", shortCode: "BOU", seed: 21 },
  { id: "l-mertens", name: "Elise Mertens", iso: "be", shortCode: "MER", seed: 25 },
  // -- Unseeded/seeded R32 players eliminated in that round (kept for R32 pairing/history) --
  { id: "l-ostapenko", name: "Jelena Ostapenko", iso: "lv", shortCode: "OST" },
  { id: "l-kasatkina", name: "Daria Kasatkina", iso: "au", shortCode: "KAS" },
  { id: "l-sawangkaew", name: "Mananchaya Sawangkaew", iso: "th", shortCode: "SAW" },
  { id: "l-bartunkova", name: "Nikola Bartunkova", iso: "cz", shortCode: "BAR" },
  { id: "l-bouzas-maneiro", name: "Jessica Bouzas Maneiro", iso: "es", shortCode: "BZM" },
  { id: "l-alexandrova", name: "Ekaterina Alexandrova", iso: "ru", shortCode: "ALE", seed: 18 },
  { id: "l-kalinskaya", name: "Anna Kalinskaya", iso: "ru", shortCode: "KAL", seed: 19 },
  { id: "l-liu", name: "Claire Liu", iso: "us", shortCode: "LIU" },
  { id: "l-snigur", name: "Daria Snigur", iso: "ua", shortCode: "SNI" },
  { id: "l-navarro", name: "Emma Navarro", iso: "us", shortCode: "NAV", seed: 23 },
  { id: "l-sakkari", name: "Maria Sakkari", iso: "gr", shortCode: "SAK" },
  { id: "l-swiatek", name: "Iga Swiatek", iso: "pl", shortCode: "SWI", seed: 3 },
  { id: "l-anisimova", name: "Amanda Anisimova", iso: "us", shortCode: "ANI", seed: 6 },
  { id: "l-cirstea", name: "Sorana Cirstea", iso: "ro", shortCode: "CIR", seed: 17 },
  { id: "l-samsonova", name: "Liudmila Samsonova", iso: "ru", shortCode: "SAM" },
  { id: "l-rybakina", name: "Elena Rybakina", iso: "kz", shortCode: "RYB", seed: 2 },
];

export const ALL_PLAYERS: Player[] = [...GENTLEMENS_PLAYERS, ...LADIES_PLAYERS];

export const PLAYERS_BY_ID: Record<string, Player> = Object.fromEntries(
  ALL_PLAYERS.map((p) => [p.id, p]),
);

export function playerById(id?: string | null): Player | undefined {
  if (!id) return undefined;
  return PLAYERS_BY_ID[id];
}
