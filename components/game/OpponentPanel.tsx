"use client";

import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import { ScoreTrack } from "@/components/game/ScoreTrack";
import { RESOURCE_META, RESOURCE_TYPES } from "@/game-data/resources";
import { GemIcon } from "@/components/gems/GemIcon";
import { isHiddenCard } from "@/game-engine/hidden";
import { cardArtSrc, deckBackSrc, tokenArtSrc } from "@/lib/art";
import { cn } from "@/lib/utils";
import { GAME_RULES } from "@/game-engine/rules/constants";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import type { ClientPlayerState } from "@/game-engine/types";

interface OpponentPanelProps {
  player: ClientPlayerState;
  isCurrent: boolean;
  /** Tighter panel, used when several opponents share the left column. */
  compact?: boolean;
}

export function OpponentPanel({ player, isCurrent, compact = false }: OpponentPanelProps) {
  const tokenTotal = RESOURCE_TYPES.reduce((sum, type) => sum + player.tokens[type], 0);

  const nobles = player.achievements.length;

  return (
    <section
      className={cn(
        "seat-plaque w-full rounded-xl border-2 px-3.5 py-3 transition-[border-color,box-shadow] duration-300",
        isCurrent ? "seat-active border-gold" : "border-transparent",
        compact && "seat-compact",
      )}
    >
      <div className="flex items-center gap-2.5">
        <PlayerAvatar id={player.avatar} size={42} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-base leading-tight text-ink">{player.name}</h2>
          <p className="mt-0.5 text-[0.68rem] font-semibold tracking-[0.1em] text-ink/60">
            {isCurrent && <span className="text-[#dcc48a]">PLAYING · </span>}
            {tokenTotal}/{GAME_RULES.maxTokensInHand} GEMS · {player.cards.length} CARDS
            {nobles > 0 && ` · ${nobles} PATRON${nobles === 1 ? "" : "S"}`}
          </p>
        </div>
        <span className="gold-glow font-numeral text-5xl leading-none font-black text-[#dcc48a]">
          <AnimatedNumber value={player.points} />
        </span>
      </div>
      <ScoreTrack points={player.points} className="mt-2" />
      <div className="mt-3 grid grid-cols-[auto_repeat(6,minmax(0,1fr))] items-center gap-x-2 gap-y-2.5 pr-1.5">
        <span className="zone-label !text-[0.6rem]">CARDS</span>
        {RESOURCE_TYPES.map((type) => {
          const cards =
            type === "ROYAL" ? 0 : player.cards.filter((card) => card.bonus === type).length;
          return (
            <div
              key={type}
              className={cn("flex justify-center", type === "ROYAL" && "ml-1 border-l border-[#cdb98c]/30 pl-2")}
              title={type === "ROYAL" ? undefined : `${RESOURCE_META[type].name}: ${cards} cards`}
            >
              {type === "ROYAL" ? (
                <span className="h-[var(--opp-card-h,2.3rem)]" />
              ) : cards > 0 ? (
                <span
                  className={cn(
                    "flex h-[var(--opp-card-h,2.3rem)] w-[var(--opp-card-w,1.75rem)] items-center justify-center rounded-[4px] font-sans text-lg leading-none font-bold tabular-nums",
                    type === "PEARL" ? "gem-disc-light" : "gem-disc-dark",
                  )}
                  style={{
                    background: type === "PEARL" ? "#f4efe4" : RESOURCE_META[type].iconColor,
                    boxShadow: "0 0 0 2px #fff, 0 1px 4px 1px rgba(0,0,0,0.3)",
                  }}
                >
                  {cards}
                </span>
              ) : (
                <span className="flex h-[var(--opp-card-h,2.3rem)] w-[var(--opp-card-w,1.75rem)] items-center justify-center rounded-[4px] border border-dashed border-[#cdb98c]/30">
                  <GemIcon type={type} size={12} className="opacity-30 grayscale" />
                </span>
              )}
            </div>
          );
        })}
        <span className="zone-label !text-[0.6rem]">GEMS</span>
        {RESOURCE_TYPES.map((type) => {
          const gems = player.tokens[type];
          return (
            <div
              key={type}
              className={cn("flex justify-center", type === "ROYAL" && "ml-1 border-l border-[#cdb98c]/30 pl-2")}
              title={`${RESOURCE_META[type].name}: ${gems}`}
            >
              <span className="relative block h-[var(--opp-chip,2rem)] w-[var(--opp-chip,2rem)]">
                {gems > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tokenArtSrc(type, 64)}
                    alt=""
                    className="h-full w-full rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
                  />
                ) : (
                  <span className="chip-slot flex h-full w-full items-center justify-center rounded-full opacity-60">
                    <GemIcon type={type} size={12} className="opacity-40 grayscale" />
                  </span>
                )}
                {gems > 0 && (
                  <span className="absolute -right-1.5 -bottom-1.5 flex h-[1.35rem] min-w-[1.35rem] items-center justify-center rounded-full bg-gradient-to-b from-[#1f2858] to-[#0d1233] px-1 font-sans text-[0.9rem] leading-none font-bold tabular-nums text-[#fff3d6] ring-2 ring-[#cdb98c]">
                    <AnimatedNumber value={gems} />
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-ink/10 pt-2.5">
        <span className="zone-label mr-1 !text-[0.6rem]">
          RESERVED {player.reservedCards.length}/{GAME_RULES.maxReservedCards}
        </span>
        {player.reservedCards.length === 0 && (
          <span className="text-xs text-ink/40">None</span>
        )}
        {player.reservedCards.map((card) =>
          isHiddenCard(card) ? (
            <span
              key={card.id}
              title="Reserved blind from a deck"
              className="mini-card h-[var(--opp-mini-h,3.3rem)] w-[var(--opp-mini-w,2.45rem)] rounded-[4px] border-2 border-white bg-cover bg-center shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
              style={{ backgroundImage: `url(${deckBackSrc(1)})` }}
            />
          ) : (
            <span
              key={card.id}
              title={`${card.name} · ${card.points} pts · ${RESOURCE_META[card.bonus].name} bonus`}
              className="mini-card relative h-[var(--opp-mini-h,3.3rem)] w-[var(--opp-mini-w,2.45rem)] overflow-hidden rounded-[4px] border-2 border-white bg-cover bg-center shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
              style={{ backgroundImage: `url(${cardArtSrc(card)})` }}
            >
              <span className="card-band absolute inset-x-0 top-0 flex h-[40%] items-center justify-between px-1">
                <span className="points-numeral font-numeral text-[0.85rem] leading-none font-black">
                  {card.points || ""}
                </span>
                <GemIcon type={card.bonus} size={13} />
              </span>
            </span>
          ),
        )}
      </div>
    </section>
  );
}
