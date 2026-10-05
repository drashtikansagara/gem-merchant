"use client";

import type { CSSProperties } from "react";
import { GemIcon } from "@/components/gems/GemIcon";
import { RESOURCE_META } from "@/game-data/resources";
import { useArtSize } from "@/components/providers/ArtSizeProvider";
import { tokenArtSrc } from "@/lib/art";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import type { ResourceType } from "@/game-engine/types";

interface GemTokenProps {
  type: ResourceType;
  count?: number;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
  /** Draw the stack height from `count` but without the number badge (decoration). */
  hideCount?: boolean;
  onClick?: () => void;
  className?: string;
  /** Seconds to offset the chip's glint, so a row of chips doesn't flash in unison. */
  glintDelay?: number;
}

/** Colour of the chip's rim, shown as the visible edge of every chip in the stack. */
const CHIP_EDGE: Record<ResourceType, string> = {
  RUBY: "#8f1b25",
  SAPPHIRE: "#173f7c",
  EMERALD: "#115c32",
  ONYX: "#0b0a09",
  PEARL: "#b3a894",
  ROYAL: "#8d6a1c",
};

const MAX_LAYERS = 5;

export function GemToken({
  type,
  count,
  selected = false,
  disabled = false,
  compact = false,
  hideCount = false,
  onClick,
  className,
  glintDelay = 0,
}: GemTokenProps) {
  const meta = RESOURCE_META[type];
  const artSize = useArtSize();
  const empty = count === 0;
  const interactive = Boolean(onClick) && !disabled && !empty;
  const layers = empty ? 1 : Math.min(Math.max(count ?? 1, 1), compact ? 4 : MAX_LAYERS);
  const edge = CHIP_EDGE[type];
  const style = {
    "--chip": compact ? "var(--seat-chip, 2.55rem)" : "var(--chip-size, 4.2rem)",
    "--edge": "calc(var(--chip) * 0.075)",
    "--glint-delay": `${glintDelay}s`,
    width: "var(--chip)",
    height: `calc(var(--chip) + var(--edge) * ${layers - 1})`,
  } as CSSProperties;

  return (
    <button
      type="button"
      disabled={disabled || empty || !onClick}
      onClick={onClick}
      title={`${meta.name}${count != null ? ` × ${count}` : ""}`}
      aria-label={`${meta.accessibilityLabel}${count != null ? `, ${count}` : ""}`}
      aria-pressed={selected}
      className={cn(
        "chip-stack relative shrink-0 rounded-full focus-ring",
        interactive && "chip-interactive cursor-pointer",
        selected && "chip-selected",
        disabled && !empty && "opacity-50",
        !onClick && "cursor-default",
        className,
      )}
      style={style}
    >
      {empty && (
        <span
          aria-hidden="true"
          className="chip-slot absolute inset-0 flex items-center justify-center rounded-full"
        >
          <GemIcon type={type} size={compact ? 16 : 22} className="opacity-35" />
        </span>
      )}
      {!empty && Array.from({ length: layers - 1 }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="chip-layer absolute left-0 rounded-full"
          style={{
            bottom: `calc(var(--edge) * ${index})`,
            width: "var(--chip)",
            height: "var(--chip)",
            background: edge,
          }}
        />
      ))}
      {!empty && (
        <span
          aria-hidden="true"
          className="chip-face absolute left-0 overflow-hidden rounded-full"
          style={{
            bottom: `calc(var(--edge) * ${layers - 1})`,
            width: "var(--chip)",
            height: "var(--chip)",
            background: edge,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={compact || artSize.ready ? tokenArtSrc(type, compact ? 128 : artSize.chip) : undefined}
            alt=""
            width={160}
            height={160}
            draggable={false}
            decoding="async"
            className="card-art-img h-full w-full object-cover"
          />
        </span>
      )}
      {count != null && !empty && !hideCount && (
        <span
          className={cn(
            "absolute -right-1.5 -bottom-1.5 z-10 flex items-center justify-center rounded-full bg-gradient-to-b from-[#1f2858] to-[#0d1233] px-1.5 font-sans leading-none font-bold tabular-nums text-[#fff3d6] shadow-[0_2px_5px_rgba(0,0,0,0.55)] ring-2 ring-[#cdb98c]",
            compact ? "h-6 min-w-6 text-[0.9rem]" : "h-7 min-w-7 text-[1.05rem]",
          )}
        >
          <AnimatedNumber value={count} />
        </span>
      )}
    </button>
  );
}
