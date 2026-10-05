"use client";

import { useSyncExternalStore } from "react";
import { STACKED_QUERY } from "@/hooks/useFitBoard";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(STACKED_QUERY);
  query.addEventListener?.("change", onChange);
  return () => query.removeEventListener?.("change", onChange);
}

/** True on phones and upright tablets, where the board stacks into one column. */
export function useStackedLayout(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(STACKED_QUERY).matches,
    () => false,
  );
}
