"use client";

import { Button } from "@/components/ui/button";
import { GemDisc } from "@/components/gems/GemDisc";
import { GemIcon } from "@/components/gems/GemIcon";
import { RESOURCE_META } from "@/game-data/resources";
import type { Card, GemType, ResourceType } from "@/game-engine/types";
import { GEM_TYPES, RESOURCE_TYPES } from "@/game-engine/types";

interface SelectedCardPanelProps {
  card: Card;
  canBuy: boolean;
  canReserve: boolean;
  /** What buying would cost after bonuses (gems + Royal), when affordable. */
  payment: Partial<Record<ResourceType, number>> | null;
  /** Gems still missing per colour after bonuses, gems and Royals, when not affordable. */
  missing: Partial<Record<GemType, number>>;
  /** Per colour, how much of the price the player's owned cards pay (each card = one gem). */
  covered: Partial<Record<GemType, number>>;
  /** Reserving also hands out a gold Royal gem while the bank has one. */
  reserveGivesRoyal: boolean;
  onBuy: () => void;
  onReserve: () => void;
  onCancel: () => void;
}

export function SelectedCardPanel({
  card,
  canBuy,
  canReserve,
  payment,
  missing,
  covered,
  reserveGivesRoyal,
  onBuy,
  onReserve,
  onCancel,
}: SelectedCardPanelProps) {
  const costs = GEM_TYPES.filter((gem) => (card.cost[gem] ?? 0) > 0);
  const paying = RESOURCE_TYPES.filter((type) => (payment?.[type] ?? 0) > 0);
  const short = GEM_TYPES.filter((gem) => (missing[gem] ?? 0) > 0);
  const coveredGems = GEM_TYPES.filter((gem) => (covered[gem] ?? 0) > 0);

  return (
    <div className="action-rail flex max-w-full items-center gap-4 rounded-lg py-1.5 pr-1.5 pl-4">
      <div className="min-w-0">
        <p className="truncate font-display text-lg leading-tight text-ink">
          {card.name}
          <span className="ml-2 font-sans text-sm text-ink/70">
            {card.points > 0 ? `${card.points} pts · ` : ""}
            {RESOURCE_META[card.bonus].name} bonus
          </span>
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="zone-label">COST</span>
          {costs.map((gem) => (
            <GemDisc key={gem} type={gem} count={card.cost[gem]} size={22} />
          ))}
        </div>
      </div>

      {coveredGems.length > 0 && (
        <div className="min-w-0 border-l border-ink/15 pl-4" title="Each card you own pays one gem of its colour, so you keep your coins">
          <p className="zone-label text-[#9fd8ff]">YOUR CARDS COVER</p>
          <div className="mt-1 flex min-h-5 items-center gap-2">
            {coveredGems.map((gem) => (
              <span key={gem} className="flex items-center gap-0.5 text-base font-semibold text-[#cdeaff]">
                <GemIcon type={gem} size={22} />×{covered[gem]}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="min-w-0 border-l border-ink/15 pl-4">
        {canBuy && payment ? (
          <>
            <p className="zone-label text-[#6ee7a0]">YOU PAY IN COINS</p>
            <div className="mt-1 flex min-h-5 items-center gap-2">
              {paying.length === 0 ? (
                <span className="text-base font-semibold text-[#6ee7a0]">Free!</span>
              ) : (
                paying.map((type) => (
                  <span key={type} className="flex items-center gap-0.5 text-base font-semibold text-ink">
                    <GemIcon type={type} size={22} />×{payment[type]}
                  </span>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <p className="zone-label text-[#ff9a6b]">STILL MISSING</p>
            <div className="mt-1 flex min-h-5 items-center gap-2">
              {short.map((gem) => (
                <span key={gem} className="flex items-center gap-0.5 text-base font-semibold text-[#ff9a6b]">
                  <GemIcon type={gem} size={22} />×{missing[gem]}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 gap-1">
        <Button size="sm" onClick={onBuy} disabled={!canBuy}>
          Buy
        </Button>
        {canReserve && (
          <Button
            size="sm"
            variant="ivory"
            onClick={onReserve}
            title={reserveGivesRoyal ? "Reserve and take a gold coin" : "Reserve (no gold left)"}
          >
            Reserve{reserveGivesRoyal ? " +" : ""}
            {reserveGivesRoyal && <GemIcon type="ROYAL" size={13} className="ml-0.5" />}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
