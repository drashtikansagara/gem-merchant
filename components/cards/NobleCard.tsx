"use client";

import { GemDisc } from "@/components/gems/GemDisc";
import { RESOURCE_META } from "@/game-data/resources";
import { nobleArtSrc } from "@/lib/art";
import { cn } from "@/lib/utils";
import type { GemType, Noble } from "@/game-engine/types";
import { GEM_TYPES } from "@/game-engine/types";

interface NobleCardProps {
  noble: Noble;
  claimed?: boolean;
  compact?: boolean;
  /** The viewing player's card bonuses, to show progress toward this noble. */
  owned?: Partial<Record<GemType, number>>;
  /** Glow when the viewer is one or two cards away (only with hints on). */
  hintClose?: boolean;
}

export function NobleCard({ noble, claimed = false, owned, hintClose = false }: NobleCardProps) {
  const reqs = GEM_TYPES.filter((gem) => (noble.requirement[gem] ?? 0) > 0);
  const met = (gem: GemType) => (owned?.[gem] ?? 0) >= (noble.requirement[gem] ?? 0);
  const missing = reqs.reduce(
    (sum, gem) => sum + Math.max(0, (noble.requirement[gem] ?? 0) - (owned?.[gem] ?? 0)),
    0,
  );
  const wide = reqs.length > 3;
  const close = hintClose && owned != null && missing > 0 && missing <= 2;
  const label = `${noble.name}, ${noble.points} points, requires ${reqs
    .map((gem) => `${noble.requirement[gem]} ${RESOURCE_META[gem].name}`)
    .join(", ")}${owned ? `. You need ${missing} more cards` : ""}`;

  return (
    <article
      aria-label={label}
      title={label}
      className={cn(
        "card-shadow noble-card relative shrink-0 overflow-hidden rounded-[0.5rem] border-[3px] border-[#f3dfa6] bg-[#efe6d4]",
        claimed && "opacity-40",
        close && "noble-close",
      )}
      style={{
        width: "var(--noble-size)",
        height: "var(--noble-size)",
      }}
    >
      <span
        aria-hidden="true"
        className="card-art pointer-events-none absolute inset-0"
        style={{ backgroundImage: `url(${nobleArtSrc(noble)})`, backgroundSize: "cover", backgroundPosition: "center" }}
      />
      <div
        className={cn(
          "noble-strip pointer-events-none absolute inset-y-0 left-0 z-20 flex flex-col items-center justify-between py-[5%]",
          wide ? "w-[44%]" : "w-[34%]",
        )}
      >
        <span
          className="points-numeral font-numeral leading-none font-black"
          style={{ fontSize: "calc(var(--noble-size) * 0.22)" }}
        >
          {noble.points}
        </span>
        {/* Four colours sit in a 2×2 grid so they never run off the card. */}
        <div
          className={cn(
            "items-center justify-items-center gap-[calc(var(--noble-size)*0.035)]",
            wide ? "grid grid-cols-2" : "flex flex-col",
          )}
        >
          {reqs.map((gem) => (
            <span key={gem} className="relative flex">
              <GemDisc
                type={gem}
                count={noble.requirement[gem]}
                size={wide ? "max(11px, calc(var(--noble-size) * 0.17))" : "max(12px, calc(var(--noble-size) * 0.2))"}
                square
              />
              {owned && met(gem) && (
                <span className="absolute -top-1 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#2f9e57] text-[0.6rem] leading-none font-black text-white ring-2 ring-white">
                  ✓
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
