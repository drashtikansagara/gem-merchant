import { cardArtUri, deckBackUri, hashKey, nobleArtUri } from "@/lib/cardArt";
import type { Card, Noble, ResourceType } from "@/game-engine/types";

/**
 * Card pictures are drawn in code (see lib/cardArt.ts). Each tier has nine
 * compositions: tier 1 = raw crystals, tier 2 = cut stones, tier 3 = royal treasures.
 * A "scene" is `${tier}-${variant}`.
 */
const VARIANTS = 9;
const TIER_SCENES: Record<1 | 2 | 3, readonly string[]> = {
  1: Array.from({ length: VARIANTS }, (_, i) => `1-${i}`),
  2: Array.from({ length: VARIANTS }, (_, i) => `2-${i}`),
  3: Array.from({ length: VARIANTS }, (_, i) => `3-${i}`),
};

const ART_V = "v=9";

/**
 * Token images ship in a few widths. We load the one closest to its on-screen
 * size (times device pixel ratio) so they stay crisp without wasting bandwidth.
 * Card art is vector, so its width only matters to the size measurement.
 */
export const CARD_ART_WIDTHS = [180, 270, 400, 600] as const;
export const CHIP_ART_WIDTHS = [64, 128, 192, 256] as const;
const STONE_ART_WIDTHS = [32, 64, 96] as const;

export type CardArtWidth = (typeof CARD_ART_WIDTHS)[number];
export type ChipArtWidth = (typeof CHIP_ART_WIDTHS)[number];

/** Smallest width that is at most ~1.25× upscaled for the pixels it must cover. */
export function pickWidth<T extends readonly number[]>(widths: T, neededPx: number): T[number] {
  return widths.find((width) => width * 1.25 >= neededPx) ?? widths[widths.length - 1];
}

export const TABLE_FELT_SRC = `/art/table-oak.webp?${ART_V}`;

/** Preferred scene for a card; stable for the card's whole life. */
export function cardScene(card: Pick<Card, "tier" | "artwork">): string {
  const pool = TIER_SCENES[card.tier];
  return pool[hashKey(card.artwork) % pool.length];
}

/** Picture for a card, coloured by its bonus gem. */
export function cardArtSrc(card: Pick<Card, "tier" | "artwork" | "bonus">, scene?: string): string {
  const variant = Number((scene ?? cardScene(card)).split("-")[1]) || 0;
  return cardArtUri(card.tier, card.bonus, variant);
}

/**
 * Picks a scene per card in a row so no two visible cards share artwork.
 * Cards keep their preferred scene unless an earlier slot already took it.
 */
export function distinctRowScenes(
  cards: Array<Pick<Card, "id" | "tier" | "artwork"> | null>,
  previous: Record<string, string> = {},
): Record<string, string> {
  const used = new Set<string>();
  const result: Record<string, string> = {};
  // Cards already on the table keep their scene, so a refill never repaints neighbours.
  for (const card of cards) {
    if (card && previous[card.id]) {
      result[card.id] = previous[card.id];
      used.add(previous[card.id]);
    }
  }
  for (const card of cards) {
    if (!card || result[card.id]) continue;
    const pool = TIER_SCENES[card.tier];
    const start = pool.indexOf(cardScene(card));
    let scene = pool[start];
    for (let step = 0; step < pool.length && used.has(scene); step += 1) {
      scene = pool[(start + step + 1) % pool.length];
    }
    used.add(scene);
    result[card.id] = scene;
  }
  return result;
}

export function deckBackSrc(tier: 1 | 2 | 3): string {
  return deckBackUri(tier);
}

/**
 * Art file per token. The wild gold coin uses the plain gold ("amber") artwork:
 * the older "royal" art has a purple jewel and read as a sixth gem colour.
 */
function artName(type: ResourceType): string {
  return type === "ROYAL" ? "amber" : type.toLowerCase();
}

export function tokenArtSrc(type: ResourceType, width: ChipArtWidth = 192): string {
  return `/art/tokens/${artName(type)}-${width}.webp?${ART_V}`;
}

/** `displayPx` is the icon's CSS size; assume a 2× screen so icons stay crisp everywhere. */
export function stoneArtSrc(type: ResourceType, displayPx = 24): string {
  const width = pickWidth(STONE_ART_WIDTHS, displayPx * 2);
  return `/art/stones/${artName(type)}-${width}.webp?${ART_V}`;
}

export function nobleArtSrc(noble: Pick<Noble, "portrait" | "name" | "requirement">): string {
  return nobleArtUri(noble);
}

/** Every image file the table can show, for warming the browser cache up front. */
export function allTableArt(chip: ChipArtWidth): string[] {
  const types: ResourceType[] = ["RUBY", "SAPPHIRE", "EMERALD", "ONYX", "PEARL", "ROYAL"];
  return types.map((type) => tokenArtSrc(type, chip));
}
