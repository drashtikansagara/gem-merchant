"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ArtSize } from "@/components/providers/ArtSizeProvider";
import { CARD_ART_WIDTHS, CHIP_ART_WIDTHS, pickWidth } from "@/lib/art";

/**
 * Sizes the market to the space actually available, so the board never
 * spills over the header or action bar on short or narrow windows.
 *
 * Writes CSS variables straight onto the board element (no React re-render),
 * which keeps window resizing smooth. It also reports which image widths match
 * the drawn size; that only re-renders when a size bucket actually changes.
 */
/** Layout switches to one column (opponents / market / bank stacked). */
export const STACKED_QUERY = "(max-width: 900px), (max-aspect-ratio: 1/1)";
/** Below this width the stacked board scrolls instead of fitting the height. */
const PHONE_MAX_WIDTH = 640;

export function useFitBoard<T extends HTMLElement, M extends HTMLElement>() {
  const boardRef = useRef<T>(null);
  const mainRef = useRef<M>(null);
  const [artSize, setArtSize] = useState<ArtSize>({ card: 400, chip: 192, ready: false });

  useLayoutEffect(() => {
    const board = boardRef.current;
    const main = mainRef.current;
    if (!board || !main) return;

    const report = (cardW: number, chip: number) => {
      const dpr = window.devicePixelRatio || 1;
      const next: ArtSize = {
        card: pickWidth(CARD_ART_WIDTHS, cardW * dpr),
        chip: pickWidth(CHIP_ART_WIDTHS, chip * dpr),
        ready: true,
      };
      setArtSize((current) =>
        current.ready && current.card === next.card && current.chip === next.chip
          ? current
          : next,
      );
    };

    // Keep in sync with the stacked-layout media query in globals.css.
    const stackedQuery = window.matchMedia(STACKED_QUERY);

    const fit = () => {
      if (stackedQuery.matches) {
        fitStacked();
        return;
      }
      board.removeAttribute("data-scroll");
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const height = main.clientHeight - 1.2 * rem - 16;
      // Side columns (players + bank) at their minimum, plus gaps and padding.
      const width = main.clientWidth - 31 * rem;
      // Nobles sit in a row on top of the market, so the mat is ~4 card heights
      // tall (nobles + 3 rows + gaps + padding) and ~4 wide (deck + 4 cards).
      const cardH = Math.min(260, Math.max(56, Math.min(height / 4, width / 4)));
      const chip = Math.min(4.4 * rem, Math.max(2.2 * rem, cardH * 0.34));
      // A full stack is 1.3 chips tall, plus the 0.3-chip row gap from .bank.
      const chipBlock = chip * 1.6;
      // Six piles (five gems + gold): one column when they fit, else two.
      const rows = Math.floor((height - 1.5 * rem) / chipBlock) >= 6 ? 6 : 3;
      board.style.setProperty("--fit-card-h", `${cardH}px`);
      board.style.setProperty("--chip-size", `${chip}px`);
      board.style.setProperty("--bank-rows", String(rows));
      report(cardH * 0.7, chip);
    };

    /**
     * Phones and upright tablets: opponents above, bank below, the market uses
     * the full width. Phones scroll; tablets also fit the height.
     */
    const fitStacked = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const width = main.clientWidth - 2.5 * rem;
      const byWidth = width / 4.15;
      // Seven stacks in one row, each with a 0.32-chip gap, must fit the width.
      const chip = Math.min(3.8 * rem, width / (7 * 1.32 + 0.6), Math.max(2.3 * rem, byWidth * 0.3));
      let cardH = byWidth;
      let scroll = window.innerWidth <= PHONE_MAX_WIDTH;
      if (!scroll) {
        // Measure against the window, not the main zone: the zone grows once the
        // board scrolls, which would otherwise flip the decision back and forth.
        const px = (selector: string) => board.querySelector<HTMLElement>(selector)?.offsetHeight ?? 0;
        const side = px(".zone-side");
        const chrome = px("header") + px(".zone-rail") + px(".zone-player");
        const bank = chip * 1.3 + 1.6 * rem;
        const height = window.innerHeight - chrome - side - bank - 5 * rem;
        const fitted = Math.min(byWidth, height / 4.4);
        // Cards squeezed below a readable size are worse than a short scroll.
        const readable = Math.min(byWidth, 104);
        if (fitted < readable) {
          cardH = readable;
          scroll = true;
        } else {
          cardH = fitted;
        }
      }
      cardH = Math.min(216, Math.max(48, cardH));
      board.toggleAttribute("data-scroll", scroll);
      board.style.setProperty("--fit-card-h", `${cardH}px`);
      board.style.setProperty("--chip-size", `${chip}px`);
      board.style.removeProperty("--bank-rows");
      report(cardH * 0.7, chip);
    };

    // A failed measurement must never leave the board without art: fall back
    // to the default image sizes and let CSS size the board.
    const safeFit = () => {
      try {
        fit();
      } catch {
        setArtSize((current) => (current.ready ? current : { ...current, ready: true }));
      }
    };

    safeFit();
    const observer = new ResizeObserver(safeFit);
    observer.observe(main);
    stackedQuery.addEventListener?.("change", safeFit);
    return () => {
      observer.disconnect();
      stackedQuery.removeEventListener?.("change", safeFit);
    };
  }, []);

  return { boardRef, mainRef, artSize };
}
