"use client";

import { GAME_CONFIG } from "@/lib/config";
import { Button } from "@/components/ui/button";
import {
  THEMES,
  useSettings,
  type PrivacyLevel,
} from "@/components/providers/SettingsProvider";
import { HOLD_MS, type useSecretHints } from "@/hooks/useSecretHints";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface GameHeaderProps {
  roomCode?: string;
  turnNumber: number;
  yourTurn: boolean;
  currentName: string;
  /** Someone reached the target: the round finishes, then the game ends. */
  finalRound?: boolean;
  spectator?: boolean;
  spectatorCount?: number;
  onLeave: () => void;
  /** Press-and-hold handlers for the hidden hint switch on the logo. */
  hintHold?: { holding: boolean; props: ReturnType<typeof useSecretHints>["holdProps"] };
}

export function GameHeader({
  roomCode,
  turnNumber,
  yourTurn,
  currentName,
  finalRound = false,
  spectator = false,
  spectatorCount = 0,
  onLeave,
  hintHold,
}: GameHeaderProps) {
  const {
    sound,
    setSound,
    theme,
    setTheme,
    privacyLevel,
    setPrivacyLevel,
    togglePrivacy,
  } =
    useSettings();
  const privacy = theme === "privacy";
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Close on any click outside the menu, or Escape. (A full-screen backdrop
  // can't be used: the header's backdrop blur confines fixed children to it.)
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="game-header relative z-20 grid h-full shrink-0 backdrop-blur-sm shadow-[0_4px_18px_rgba(0,0,0,0.4)] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4">
      <div className="flex min-w-0 items-baseline gap-3">
        <h1
          className="relative min-w-0 cursor-default touch-none truncate font-display text-base select-none sm:text-lg tracking-[0.04em] text-[#d6bf8a] drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] [-webkit-touch-callout:none]"
          {...hintHold?.props}
        >
          {GAME_CONFIG.name}
          {hintHold && (
            <span
              aria-hidden="true"
              className={cn("hint-hold", hintHold.holding && "hint-hold-on")}
              style={{ "--hold-ms": `${HOLD_MS}ms` } as CSSProperties}
            />
          )}
        </h1>
        {spectator && (
          <span className="shrink-0 rounded-full border border-[#dcc48a]/50 bg-[#dcc48a]/15 px-2 py-0.5 text-[0.7rem] font-bold tracking-[0.1em] text-[#dcc48a]">
            SPECTATING
          </span>
        )}
        {roomCode && (
          <p className="hidden truncate text-[0.78rem] tracking-[0.1em] text-[#f3ead8]/60 sm:block">
            ROOM {roomCode}
          </p>
        )}
      </div>
      <div className="px-4 text-center">
        <p
          className={cn(
            "font-display text-xl leading-tight tracking-[0.08em]",
            yourTurn ? "turn-glow text-[#dcc48a]" : "text-[#f3ead8]/85",
          )}
        >
          {yourTurn ? "YOUR TURN" : `${currentName.toUpperCase()}'S TURN`}
        </p>
        {finalRound ? (
          <p className="final-round mx-auto mt-0.5 w-fit rounded-full px-2.5 text-[0.7rem] font-bold tracking-[0.1em]">
            FINAL ROUND
          </p>
        ) : (
          <p className="text-[0.7rem] tracking-[0.14em] text-[#f3ead8]/55">
            {yourTurn ? "Choose your action" : "Waiting..."}
          </p>
        )}
      </div>
      <div className="flex items-center justify-end gap-3">
        {spectatorCount > 0 && (
          <p
            className="flex items-center gap-1 text-[0.78rem] tracking-[0.12em] text-[#f3ead8]/70"
            title={`${spectatorCount} watching`}
          >
            <EyeIcon />
            {spectatorCount}
          </p>
        )}
        <p className="hidden text-[0.78rem] tracking-[0.08em] text-[#f3ead8]/70 sm:block">
          TURN {turnNumber}
        </p>
        <button
          type="button"
          aria-pressed={privacy}
          title={privacy ? "Privacy screen on (click to turn off)" : "Privacy screen: dim the table so others can't read it"}
          aria-label="Privacy screen"
          onClick={togglePrivacy}
          className={cn(
            "focus-ring flex h-8 w-8 items-center justify-center rounded-full transition-colors",
            privacy ? "bg-white/10 text-[#f3ead8]" : "text-[#f3ead8]/60 hover:text-[#f3ead8]",
          )}
        >
          <PrivacyIcon on={privacy} />
        </button>
        <Button
          ref={toggleRef}
          variant="ghost"
          size="sm"
          aria-expanded={open}
          className="text-[#f3ead8]/70 hover:text-[#f3ead8]"
          onClick={() => setOpen((v) => !v)}
        >
          Settings
        </Button>
      </div>
      {open && (
        <>
          <div
            ref={menuRef}
            role="dialog"
            aria-label="Settings"
            className="parchment absolute top-12 right-4 z-30 w-64 rounded-xl p-4 text-ink"
          >
            <p className="zone-label mb-2">SETTINGS</p>
            <Toggle label="Sound effects" checked={sound} onChange={setSound} />
            <p className="zone-label mt-3 mb-1.5 px-2">THEME</p>
            <div className="grid grid-cols-4 gap-1.5 px-2" role="radiogroup" aria-label="Theme">
              {THEMES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={theme === option.id}
                  onClick={() => setTheme(option.id)}
                  className={cn(
                    "focus-ring flex flex-col items-center gap-1 rounded-lg py-1.5 text-[0.7rem] text-ink/75 hover:bg-ink/5",
                    theme === option.id && "bg-ink/10 font-semibold text-ink",
                  )}
                >
                  <span
                    className={cn(
                      "h-6 w-6 rounded-full ring-1 ring-ink/20",
                      theme === option.id && "ring-2 ring-[#b58a32]",
                    )}
                    style={{ background: option.swatch }}
                  />
                  {option.label}
                </button>
              ))}
            </div>
            {privacy && (
              <div className="mt-2 px-2">
                <p className="mb-1 text-xs text-ink/70">Privacy strength</p>
                <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Privacy strength">
                  {([1, 2, 3] as PrivacyLevel[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      role="radio"
                      aria-checked={privacyLevel === level}
                      onClick={() => setPrivacyLevel(level)}
                      className={cn(
                        "focus-ring rounded-md border border-ink/15 py-1 text-xs text-ink/75 hover:bg-ink/5",
                        privacyLevel === level && "border-[#b58a32] bg-ink/10 font-semibold text-ink",
                      )}
                    >
                      {level === 1 ? "Light" : level === 2 ? "Medium" : "Max"}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <a
              href="/how-to-play"
              target="_blank"
              rel="noreferrer"
              className="mt-2 block rounded-lg px-2 py-2 text-sm text-ink/75 hover:bg-ink/5 hover:text-ink"
            >
              How to play ↗
            </a>
            <Button variant="ivory" size="sm" className="mt-2 w-full" onClick={onLeave}>
              {spectator ? "Stop Watching" : "Leave Game"}
            </Button>
          </div>
        </>
      )}
    </header>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="focus-ring flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-ink/5"
    >
      {label}
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-gradient-to-b from-[#cdb98c] to-[#b58a32]" : "bg-ink/20",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}

function PrivacyIcon({ on }: { on: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 20h6M12 16v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {on && <path d="M4.5 15.5 19.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
