"use client";

import { CardArt } from "@/components/cards/CardArt";
import { GemDisc } from "@/components/gems/GemDisc";
import { GemIcon } from "@/components/gems/GemIcon";
import { RESOURCE_META } from "@/game-data/resources";
import { deckBackSrc } from "@/lib/art";
import { cn } from "@/lib/utils";
import type { Card, GemType } from "@/game-engine/types";
import type { PointerEvent } from "react";

/** Tilt the card toward the pointer and move the light sheen with it. */
function tiltToPointer(event: PointerEvent<HTMLButtonElement>) {
  if (event.pointerType !== "mouse") return;
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  el.style.setProperty("--ry", `${(x - 0.5) * 14}deg`);
  el.style.setProperty("--rx", `${(0.5 - y) * 12}deg`);
  el.style.setProperty("--mx", `${x * 100}%`);
  el.style.setProperty("--my", `${y * 100}%`);
}

function resetTilt(event: PointerEvent<HTMLButtonElement>) {
  const el = event.currentTarget;
  el.style.removeProperty("--rx");
  el.style.removeProperty("--ry");
}
import { GEM_TYPES } from "@/game-engine/types";

interface DevelopmentCardProps {
  card: Card;
  affordable?: boolean;
  selected?: boolean;
  reserved?: boolean;
  compact?: boolean;
  facedown?: boolean;
  unavailable?: boolean;
  /** Scene override so a market row never shows the same artwork twice. */
  scene?: string;
  onClick?: () => void;
}

export function DevelopmentCard({
  card,
  affordable = false,
  selected = false,
  reserved = false,
  compact = false,
  facedown = false,
  unavailable = false,
  scene,
  onClick,
}: DevelopmentCardProps) {
  const costs = GEM_TYPES.filter((gem) => (card.cost[gem] ?? 0) > 0);
  const bonusName = RESOURCE_META[card.bonus].name;
  const label = facedown
    ? "Reserved card"
    : `${card.name}, ${card.points} points, ${bonusName} bonus, ${costLabel(card.cost)}`;
  // Prices sit straight on the picture in a column at the bottom left, sized from
  // the card height so four discs always fit under the top band
  // (4 × 0.155 + 3 gaps × 0.022 + margin < 0.75). Compact cards scale with
  // --seat-card-w, which the player panels enlarge.
  const cardH = compact ? "calc(var(--seat-card-w, 3.4rem) * 4 / 3)" : "var(--card-h)";
  const disc = `calc(${cardH} * 0.155)`;
  const tilt = !compact && onClick != null;
  const bonus = compact ? 16 : 28;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={!onClick}
      onPointerMove={tilt ? tiltToPointer : undefined}
      onPointerLeave={tilt ? resetTilt : undefined}
      className={cn(
        "card-face card-shadow relative shrink-0 overflow-hidden bg-[#efe6d4] text-left focus-ring",
        compact ? "rounded-[0.3rem] border-2 border-[#ece4d4]" : "rounded-[0.55rem] border-[3px] border-[#ece4d4]",
        tilt ? "card-tilt" : onClick && "card-lift",
        selected && "card-selected",
        affordable && !selected && "card-affordable",
        !onClick && "cursor-default",
      )}
      style={
        compact
          ? { width: "var(--seat-card-w, 3.4rem)", height: "calc(var(--seat-card-w, 3.4rem) * 4 / 3)" }
          : { width: "var(--card-w)", height: "var(--card-h)" }
      }
    >
      {facedown ? (
        <CardBack tier={card.tier} reserved={reserved} />
      ) : (
        <>
          <CardArt card={card} scene={scene} />
          {unavailable && !affordable && !selected && (
            <span className="pointer-events-none absolute inset-0 z-10 bg-[#140c05]/22" />
          )}
          <span
            className={cn(
              "card-band pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between",
              compact ? "h-[26%] px-1" : "h-[25%] px-[7%]",
            )}
          >
            <span
              className="points-numeral font-numeral leading-none font-black"
              style={{ fontSize: compact ? "calc(var(--seat-card-w, 3.4rem) * 0.31)" : "calc(var(--card-h) * 0.2)" }}
            >
              {card.points > 0 ? card.points : ""}
            </span>
            <span
              className="flex shrink-0 items-center justify-center"
              style={
                compact
                  ? { width: "calc(var(--seat-card-w, 3.4rem) * 0.3)", height: "calc(var(--seat-card-w, 3.4rem) * 0.3)" }
                  : { width: "calc(var(--card-w) * 0.29)", height: "calc(var(--card-w) * 0.29)" }
              }
            >
              <GemIcon
                type={card.bonus}
                size={compact ? bonus : 44}
                title={`Permanent ${bonusName} bonus`}
                className="!h-full !w-full drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)]"
              />
            </span>
          </span>
          <div
            className="pointer-events-none absolute bottom-[3.5%] left-[5%] z-20 flex flex-col items-start"
            style={{ gap: `calc(${cardH} * 0.022)` }}
          >
            {costs.map((gem) => (
              <GemDisc key={gem} type={gem} count={card.cost[gem]} size={disc} fontScale={0.8} />
            ))}
          </div>
          {reserved && <ReservedRibbon />}
          {tilt && <span aria-hidden="true" className="card-sheen" />}
        </>
      )}
    </button>
  );
}

function ReservedRibbon() {
  return (
    <span className="absolute top-0 left-1 z-30 h-4 w-2.5 rounded-b-sm bg-gold shadow-[0_2px_4px_rgba(0,0,0,0.25)]" />
  );
}

function CardBack({ tier, reserved }: { tier: 1 | 2 | 3; reserved: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="card-art absolute inset-0"
        style={{
          backgroundImage: `url(${deckBackSrc(tier)})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      {reserved && <ReservedRibbon />}
    </>
  );
}

function costLabel(cost: Partial<Record<GemType, number>>): string {
  return GEM_TYPES.filter((gem) => (cost[gem] ?? 0) > 0)
    .map((gem) => `${cost[gem]} ${RESOURCE_META[gem].name}`)
    .join(", ");
}
