"use client";

import { createContext, useContext } from "react";
import type { CardArtWidth, ChipArtWidth } from "@/lib/art";

export interface ArtSize {
  card: CardArtWidth;
  chip: ChipArtWidth;
  /** False until the board is measured; images wait so they are fetched once at the right size. */
  ready: boolean;
}

/** Image widths matched to how big cards and chips are drawn right now. */
export const ArtSizeContext = createContext<ArtSize>({ card: 400, chip: 192, ready: true });

export function useArtSize(): ArtSize {
  return useContext(ArtSizeContext);
}
