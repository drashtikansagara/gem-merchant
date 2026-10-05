"use client";

import { useState } from "react";
import { DevelopmentCard } from "@/components/cards/DevelopmentCard";
import { GemIcon } from "@/components/gems/GemIcon";
import { RESOURCE_META } from "@/game-data/resources";
import { cardArtSrc } from "@/lib/art";
import { cn } from "@/lib/utils";
import type { Card, GemType } from "@/game-engine/types";

interface BonusStackProps {
  gem: GemType;
  cards: Card[];
}

/** A pile of owned development cards of one colour, drawn as stacked cards. */
export function BonusStack({ gem, cards }: BonusStackProps) {
  const [open, setOpen] = useState(false);
  const meta = RESOURCE_META[gem];
  const points = cards.reduce((sum, card) => sum + card.points, 0);
  const top = cards[cards.length - 1];
  const layers = Math.min(cards.length - 1, 4);
  const empty = cards.length === 0;

  return (
    <div
      className="relative"
      onMouseEnter={() => !empty && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        disabled={empty}
        className={cn(
          "bonus-pile focus-ring relative block overflow-hidden rounded-[0.3rem] border-2",
          empty ? "border-dashed border-ink/20 bg-ink/5" : "border-white",
        )}
        aria-label={`${cards.length} ${meta.name} developments, ${points} points`}
        title={`${meta.name} bonus × ${cards.length}${points ? ` · ${points} pts` : ""}`}
        onClick={() => setOpen((value) => !value)}
        style={{
          width: "var(--seat-pile-w, 2.7rem)",
          height: "calc(var(--seat-pile-w, 2.7rem) * 1.3)",
          marginLeft: layers * 2,
          backgroundImage: top ? `url(${cardArtSrc(top)})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          boxShadow: empty
            ? undefined
            : [
                ...Array.from({ length: layers }, (_, index) => {
                  const offset = (index + 1) * 2;
                  return `-${offset}px ${offset}px 0 ${index % 2 === 0 ? "var(--card-edge-a, #fbf7ef)" : "var(--card-edge-b, #b9ad99)"}`;
                }),
                "-2px 6px 10px rgba(0,0,0,0.3)",
              ].join(", "),
        }}
      >
        <span
          className={cn(
            "absolute inset-x-0 top-0 flex h-[42%] items-center justify-center",
            !empty && "card-band",
          )}
        >
          <GemIcon
            type={gem}
            size={28}
            className={cn("!h-[calc(var(--seat-pile-w,2.7rem)*0.46)] !w-auto", empty && "opacity-30 grayscale")}
          />
        </span>
        {!empty && (
          <span
            className="points-numeral absolute inset-x-0 bottom-0.5 text-center font-numeral leading-none font-black"
            style={{ fontSize: "calc(var(--seat-pile-w, 2.7rem) * 0.46)" }}
          >
            {cards.length}
          </span>
        )}
      </button>
      {open && !empty && (
        <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-40 flex gap-1 rounded-md border border-gold/30 bg-surface/95 p-2 shadow-xl">
          {cards.slice(-5).map((card) => (
            <DevelopmentCard key={card.id} card={card} compact />
          ))}
        </div>
      )}
    </div>
  );
}
