import type { Card, GemType } from "@/game-engine/types";
import { GEM_TYPES } from "@/game-data/resources";

// Original Gem Merchant price list. Each recipe is written relative to the card's
// own colour: offset 0 is the bonus colour, 1–4 walk round GEM_TYPES. Rotating
// the same recipes through every colour keeps the five colours equally in demand.
// Each entry: [points, cost by offset].
type Recipe = [points: number, cost: Partial<Record<0 | 1 | 2 | 3 | 4, number>>];

const RECIPES: Record<1 | 2 | 3, Recipe[]> = {
  1: [
    [0, { 1: 1, 2: 1, 3: 1 }],
    [0, { 1: 1, 2: 1, 4: 2 }],
    [0, { 3: 2, 4: 1 }],
    [0, { 0: 1, 1: 2, 2: 1 }],
    [0, { 2: 2, 4: 2 }],
    [0, { 1: 1, 3: 3 }],
    [0, { 2: 2, 3: 2, 4: 1 }],
    [1, { 1: 2, 3: 3 }],
  ],
  2: [
    [1, { 1: 2, 3: 2, 4: 3 }],
    [1, { 0: 2, 2: 3, 3: 2 }],
    [2, { 1: 3, 4: 4 }],
    [2, { 0: 1, 2: 5 }],
    [2, { 1: 2, 2: 4, 3: 2 }],
    [3, { 2: 2, 4: 5 }],
  ],
  3: [
    [3, { 1: 4, 2: 2, 3: 3, 4: 3 }],
    [4, { 2: 6, 4: 2 }],
    [4, { 0: 2, 3: 5, 4: 4 }],
    [5, { 1: 6, 3: 4 }],
  ],
};

function priceFor(bonus: GemType, recipe: Recipe[1]): Partial<Record<GemType, number>> {
  const base = GEM_TYPES.indexOf(bonus);
  const cost: Partial<Record<GemType, number>> = {};
  for (const [offset, amount] of Object.entries(recipe)) {
    cost[GEM_TYPES[(base + Number(offset)) % GEM_TYPES.length]] = amount;
  }
  return cost;
}

const NAMES: Record<1 | 2 | 3, Record<GemType, string[]>> = {
  1: {
    RUBY: ["Ember Chip", "Hearth Cabochon", "Cinder Facet", "Market Ruby", "Kiln Shard", "Scarlet Bead", "Forge Spark", "Garnet Pick"],
    SAPPHIRE: ["Tide Chip", "Harbor Facet", "Wellspring Bead", "Dusk Sapphire", "Lantern Ice", "Coastal Cabochon", "Raincut Shard", "Brook Pick"],
    EMERALD: ["Grove Chip", "Vine Cabochon", "Moss Facet", "Orchard Bead", "Canopy Shard", "Fern Cut", "Glade Spark", "Meadow Pick"],
    ONYX: ["Night Chip", "Ink Cabochon", "Basalt Facet", "Shadow Bead", "Quarry Shard", "Umber Cut", "Hearthstone Spark", "Cavern Pick"],
    PEARL: ["Mist Chip", "Moon Bead", "Harbor Pearl", "Silk Cabochon", "Foam Facet", "Ivory Shard", "Quiet Spark", "Shell Pick"],
  },
  2: {
    RUBY: ["Crimson Bracelet", "Ember Coffer", "Ruby Circlet", "Garnet Gallery", "Flame Collection", "Scarlet Atelier"],
    SAPPHIRE: ["Azure Bracelet", "Tide Coffer", "Sapphire Circlet", "Indigo Gallery", "Deep Collection", "Harbor Atelier"],
    EMERALD: ["Verdant Bracelet", "Grove Coffer", "Emerald Circlet", "Jade Gallery", "Canopy Collection", "Orchard Atelier"],
    ONYX: ["Nocturne Bracelet", "Obsidian Coffer", "Onyx Circlet", "Midnight Gallery", "Umber Collection", "Basalt Atelier"],
    PEARL: ["Moon Bracelet", "Nacre Coffer", "Pearl Circlet", "Opal Gallery", "Mist Collection", "Ivory Atelier"],
  },
  3: {
    RUBY: ["Ruby Diadem", "Ceremonial Ember", "Scarlet Relic", "Crimson Throne"],
    SAPPHIRE: ["Sapphire Diadem", "Ceremonial Tide", "Azure Relic", "Tidal Throne"],
    EMERALD: ["Emerald Diadem", "Ceremonial Grove", "Verdant Relic", "Canopy Throne"],
    ONYX: ["Onyx Diadem", "Ceremonial Night", "Basalt Relic", "Midnight Throne"],
    PEARL: ["Pearl Diadem", "Ceremonial Moon", "Nacre Relic", "Moonlit Throne"],
  },
};

const ART: Record<1 | 2 | 3, string[]> = {
  1: ["chip", "ring", "pick", "bead", "shard", "cabochon", "spark", "quarry"],
  2: ["bracelet", "chest", "circlet", "gallery", "collection", "atelier"],
  3: ["crown", "necklace", "relic", "fortress"],
};

function buildCatalog(): Card[] {
  const cards: Card[] = [];
  for (const tier of [1, 2, 3] as const) {
    for (const bonus of GEM_TYPES) {
      RECIPES[tier].forEach(([points, recipe], i) => {
        cards.push({
          id: `${bonus.toLowerCase()}-t${tier}-${String(i + 1).padStart(2, "0")}`,
          name: NAMES[tier][bonus][i],
          tier,
          points,
          bonus,
          cost: priceFor(bonus, recipe),
          artwork: `${bonus.toLowerCase()}-${ART[tier][i]}`,
        });
      });
    }
  }
  return cards;
}

export const CARD_CATALOG: Card[] = buildCatalog();

export function cardsByTier(tier: 1 | 2 | 3): Card[] {
  return CARD_CATALOG.filter((card) => card.tier === tier);
}
