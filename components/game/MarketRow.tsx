"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { DevelopmentCard } from "@/components/cards/DevelopmentCard";
import { GAME_CONFIG } from "@/lib/config";
import { deckBackSrc, distinctRowScenes } from "@/lib/art";
import type { Card } from "@/game-engine/types";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

interface MarketRowProps {
  tier: 1 | 2 | 3;
  cards: Array<Card | null>;
  deckCount: number;
  affordableIds: Set<string>;
  selectedId?: string | null;
  dimUnaffordable?: boolean;
  onSelectCard: (card: Card) => void;
  onSelectDeck: (tier: 1 | 2 | 3) => void;
}

const DEAL = { type: "spring", stiffness: 260, damping: 26, mass: 0.8 } as const;

export function MarketRow({
  tier,
  cards,
  deckCount,
  affordableIds,
  selectedId,
  dimUnaffordable = false,
  onSelectCard,
  onSelectDeck,
}: MarketRowProps) {
  // Remember scenes between renders (React's "store info from previous renders" pattern).
  const [scenes, setScenes] = useState<Record<string, string>>(() => distinctRowScenes(cards));
  const nextScenes = distinctRowScenes(cards, scenes);
  if (Object.keys(nextScenes).some((id) => nextScenes[id] !== scenes[id])) {
    setScenes(nextScenes);
  }

  return (
    <div className="flex items-center justify-center gap-[var(--card-gap)]">
      <DeckPile tier={tier} count={deckCount} onClick={() => onSelectDeck(tier)} />
      {cards.map((card, index) => (
        <div
          key={`slot-${tier}-${index}`}
          className="relative shrink-0 [perspective:900px]"
          style={{ width: "var(--card-w)", height: "var(--card-h)" }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-[0.5rem] border border-dashed border-[#ece4d4]/25"
          />
          <AnimatePresence mode="popLayout" initial>
            {card && (
              <motion.div
                key={card.id}
                className="absolute inset-0"
                // Dealt from the deck on the left of the row: slides over edge-on, then turns face up.
                initial={{ opacity: 0, x: `-${(index + 1) * 108}%`, rotateY: -90, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, rotateY: 0, scale: 1 }}
                exit={{ opacity: 0, y: 60, scale: 0.8, transition: { duration: 0.28 } }}
                transition={{ ...DEAL, delay: index * 0.06 + (3 - tier) * 0.12 }}
              >
                <DevelopmentCard
                  card={card}
                  scene={nextScenes[card.id]}
                  affordable={affordableIds.has(card.id)}
                  selected={selectedId === card.id}
                  unavailable={dimUnaffordable && !affordableIds.has(card.id)}
                  onClick={() => onSelectCard(card)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

function DeckPile({
  tier,
  count,
  onClick,
}: {
  tier: 1 | 2 | 3;
  count: number;
  onClick: () => void;
}) {
  if (count <= 0) {
    return (
      <div
        aria-label={`Tier ${tier} deck, empty`}
        className="shrink-0 rounded-[0.5rem] border border-dashed border-[#ece4d4]/30"
        style={{ width: "var(--deck-w)", height: "var(--card-h)" }}
      />
    );
  }

  // Each visible layer is a card edge peeking out below-left, like a real pile.
  const layers = Math.min(5, Math.ceil(count / 8));
  const edges = Array.from({ length: layers }, (_, index) => {
    const offset = (index + 1) * 2;
    const color = index % 2 === 0 ? "var(--card-edge-a, #f5efe3)" : "var(--card-edge-b, #bdb2a0)";
    return `-${offset}px ${offset}px 0 ${color}`;
  });

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Reserve the top card of the tier ${tier} deck, ${count} cards left`}
      title={`Tier ${tier} deck · ${count} cards · click to reserve the top card`}
      className="deck-pile focus-ring relative shrink-0 overflow-hidden rounded-[0.5rem] border-[3px] border-[#ece4d4]"
      style={{
        width: "var(--deck-w)",
        height: "var(--card-h)",
        marginLeft: layers * 2,
        backgroundImage: `url(${deckBackSrc(tier)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        boxShadow: [...edges, "-4px 10px 14px rgba(0,0,0,0.45)"].join(", "),
      }}
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.05),rgba(0,0,0,0.4))]" />
      <span
        className="deck-logo pointer-events-none absolute inset-x-0 top-[55%] -translate-y-1/2 px-1 text-center font-display leading-none font-bold"
        style={{ fontSize: "calc(var(--deck-w) * 0.14)" }}
      >
        {GAME_CONFIG.name}
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-[9%] flex justify-center gap-[5px]">
        {Array.from({ length: tier }, (_, index) => (
          <span
            key={index}
            className="h-[9px] w-[9px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.7)]"
          />
        ))}
      </span>
      <span
        className="pointer-events-none absolute top-[5%] right-[6%] rounded-full bg-black/70 px-[0.45em] py-[0.25em] font-sans leading-none font-bold tabular-nums text-[#fff3d6] ring-1 ring-[#cdb98c]/70"
        style={{ fontSize: "max(10px, min(0.95rem, calc(var(--deck-w) * 0.17)))" }}
      >
        <AnimatedNumber value={count} />
      </span>
    </button>
  );
}
