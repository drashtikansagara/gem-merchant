"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { useSettings } from "@/components/providers/SettingsProvider";
import { playSound } from "@/lib/sound";

/**
 * Developer-only switch for card hints. Nothing on screen labels it:
 * press and hold the game's logo for HOLD_MS (mouse or touch), or tap
 * H three times quickly on a keyboard. Doing it again turns hints off.
 */
export const HOLD_MS = 1000;
const KEY_TAPS = 3;
const KEY_WINDOW_MS = 900;

export function useSecretHints() {
  const { hints, setHints } = useSettings();
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);

  const toggle = useCallback(() => {
    const next = !hints;
    setHints(next);
    // Only a soft chime (and a buzz on phones) confirms it; nothing changes on screen.
    playSound(next ? "select" : "turn");
    navigator.vibrate?.(next ? 30 : [20, 60, 20]);
  }, [hints, setHints]);

  const cancel = useCallback(() => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }, []);

  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      cancel();
      setHolding(true);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setHolding(false);
        toggle();
      }, HOLD_MS);
    },
    [cancel, toggle],
  );

  useEffect(() => {
    let taps: number[] = [];
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() !== "h") {
        taps = [];
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      const now = Date.now();
      taps = [...taps.filter((time) => now - time < KEY_WINDOW_MS), now];
      if (taps.length >= KEY_TAPS) {
        taps = [];
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return {
    hints,
    holding,
    holdProps: {
      onPointerDown,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      // A long press on touch screens would otherwise open the context menu.
      onContextMenu: (event: MouseEvent) => event.preventDefault(),
    },
  };
}
