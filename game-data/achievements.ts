import type { Noble } from "@/game-engine/types";

// Ten original patrons (3 prestige each). Requirements mix three shapes —
// 4+4, 3+3+3 and 3+2+2+2 — so every colour is wanted by five or six of them.
export const ACHIEVEMENT_CATALOG: Noble[] = [
  {
    id: "aurelia",
    name: "Lady Aurelia",
    points: 3,
    requirement: { RUBY: 4, SAPPHIRE: 4 },
    portrait: "aurelia",
  },
  {
    id: "cassian",
    name: "Lord Cassian",
    points: 3,
    requirement: { RUBY: 4, PEARL: 4 },
    portrait: "cassian",
  },
  {
    id: "seraphine",
    name: "Dame Seraphine",
    points: 3,
    requirement: { SAPPHIRE: 4, ONYX: 4 },
    portrait: "seraphine",
  },
  {
    id: "dorian",
    name: "Master Dorian",
    points: 3,
    requirement: { EMERALD: 4, PEARL: 4 },
    portrait: "dorian",
  },
  {
    id: "isolde",
    name: "Countess Isolde",
    points: 3,
    requirement: { SAPPHIRE: 3, EMERALD: 3, ONYX: 3 },
    portrait: "isolde",
  },
  {
    id: "magnus",
    name: "Baron Magnus",
    points: 3,
    requirement: { PEARL: 3, EMERALD: 3, RUBY: 3 },
    portrait: "magnus",
  },
  {
    id: "verena",
    name: "Lady Verena",
    points: 3,
    requirement: { SAPPHIRE: 3, RUBY: 3, ONYX: 3 },
    portrait: "verena",
  },
  {
    id: "lucien",
    name: "Sir Lucien",
    points: 3,
    requirement: { EMERALD: 3, ONYX: 2, PEARL: 2, SAPPHIRE: 2 },
    portrait: "lucien",
  },
  {
    id: "nora",
    name: "Keeper Nora",
    points: 3,
    requirement: { ONYX: 3, PEARL: 2, RUBY: 2, EMERALD: 2 },
    portrait: "nora",
  },
  {
    id: "thaddeus",
    name: "Patron Thaddeus",
    points: 3,
    requirement: { PEARL: 3, RUBY: 2, SAPPHIRE: 2, ONYX: 2 },
    portrait: "thaddeus",
  },
];
