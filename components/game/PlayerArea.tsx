"use client";

import { BonusStack } from "@/components/game/BonusStack";
import { DevelopmentCard } from "@/components/cards/DevelopmentCard";
import { GemToken } from "@/components/gems/GemToken";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import { ScoreTrack } from "@/components/game/ScoreTrack";
import { GAME_RULES } from "@/game-engine/rules/constants";
import { GEM_TYPES } from "@/game-data/resources";
import type { Card, ClientPlayerState, HiddenCard } from "@/game-engine/types";
import { totalTokens } from "@/game-engine/helpers";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

interface PlayerAreaProps {
  player: ClientPlayerState;
  selectedId?: string | null;
  affordableIds: Set<string>;
  onSelectCard: (card: Card) => void;
  /** "bar": one wide row under the table; "side": stacked in the left column. */
  variant?: "bar" | "side";
}

function isHidden(card: Card | HiddenCard): card is HiddenCard {
  return "hidden" in card && card.hidden;
}

export function PlayerArea({
  player,
  selectedId,
  affordableIds,
  onSelectCard,
  variant = "bar",
}: PlayerAreaProps) {
  const side = variant === "side";
  const tokenTotal = totalTokens(player.tokens);
  const nearLimit = tokenTotal >= GAME_RULES.maxTokensInHand - 2;
  const reservedSlots = Array.from(
    { length: GAME_RULES.maxReservedCards },
    (_, index) => player.reservedCards[index] ?? null,
  );

  return (
    <section
      className={
        side
          ? "player-plaque seat-side flex w-full shrink-0 flex-col gap-3 rounded-xl px-3.5 py-3"
          : "player-plaque seat-large mx-auto flex w-fit max-w-full flex-wrap items-end justify-center gap-x-[var(--plaque-gap,1.75rem)] gap-y-3 rounded-xl px-5 pt-2.5 pb-3"
      }
    >
      {side ? (
        <div>
          <div className="flex items-center gap-2.5">
            <PlayerAvatar id={player.avatar} size={42} />
            <p className="min-w-0 flex-1 truncate font-display text-base leading-tight text-ink">{player.name}</p>
            <p className="gold-glow font-numeral text-5xl leading-none font-black text-[#dcc48a]">
              <AnimatedNumber value={player.points} />
              <span className="ml-1 font-sans text-xs font-semibold tracking-[0.16em] text-ink/55">
                / {GAME_RULES.victoryPoints}
              </span>
            </p>
          </div>
          <ScoreTrack points={player.points} className="mt-2" />
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-3 self-center">
          <PlayerAvatar id={player.avatar} size={52} />
          <div className="leading-tight">
            <p className="max-w-[10rem] truncate font-display text-lg text-ink">{player.name}</p>
            <p className="gold-glow font-numeral text-5xl leading-none font-black text-[#dcc48a]">
              <AnimatedNumber value={player.points} />
              <span className="ml-1 font-sans text-xs font-semibold tracking-[0.16em] text-ink/55">
                / {GAME_RULES.victoryPoints}
              </span>
            </p>
            <ScoreTrack points={player.points} className="mt-1.5 w-32" />
          </div>
        </div>
      )}
      <div className="shrink-0">
        <p className="zone-label">
          GEMS · {tokenTotal} / {GAME_RULES.maxTokensInHand}
          {nearLimit && <span className="ml-1 text-[#ff9a6b]">· near limit</span>}
        </p>
        <div className="mt-2 flex items-end gap-[calc(var(--seat-chip)*0.22)]">
          {GEM_TYPES.map((type) => (
            <GemToken key={type} type={type} count={player.tokens[type]} compact />
          ))}
          {/* Gold is wild and comes from reserving, so it sits apart from the gem colours. */}
          <span aria-hidden="true" className="mx-1 h-10 w-px self-center bg-[#cdb98c]/35" />
          <GemToken type="ROYAL" count={player.tokens.ROYAL} compact />
        </div>
      </div>
      <div className="shrink-0">
        <p className="zone-label">DEVELOPMENTS · {player.cards.length}</p>
        <div className="mt-2 flex items-end gap-[calc(var(--seat-pile-w)*0.18)]">
          {GEM_TYPES.map((gem) => (
            <BonusStack
              key={gem}
              gem={gem}
              cards={player.cards.filter((card) => card.bonus === gem)}
            />
          ))}
        </div>
      </div>
      <div className="shrink-0">
        <p className="zone-label">
          RESERVED · {player.reservedCards.length} / {GAME_RULES.maxReservedCards}
        </p>
        <div className="mt-2 flex gap-1.5">
          {reservedSlots.map((card, index) =>
              card ? (
                isHidden(card) ? (
                  <DevelopmentCard
                    key={card.id}
                    card={{
                      id: card.id,
                      name: "Reserved",
                      tier: 1,
                      points: 0,
                      bonus: "RUBY",
                      cost: {},
                      artwork: "ruby-chip",
                    }}
                    compact
                    facedown
                    reserved
                  />
                ) : (
                  <DevelopmentCard
                    key={card.id}
                    card={card}
                    compact
                    reserved
                    affordable={affordableIds.has(card.id)}
                    selected={selectedId === card.id}
                    onClick={() => onSelectCard(card)}
                  />
                )
              ) : (
                <div
                  key={`empty-reserved-${index}`}
                  className="rounded-[0.3rem] border-2 border-dashed border-ink/15"
                  style={{ width: "var(--seat-card-w)", height: "calc(var(--seat-card-w) * 4 / 3)" }}
                />
              ),
            )}
        </div>
      </div>
    </section>
  );
}
