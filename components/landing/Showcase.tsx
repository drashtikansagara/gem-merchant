"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import { DevelopmentCard } from "@/components/cards/DevelopmentCard";
import { NobleCard } from "@/components/cards/NobleCard";
import { GemToken } from "@/components/gems/GemToken";
import { ACHIEVEMENT_CATALOG } from "@/game-data/achievements";
import { CARD_CATALOG } from "@/game-data/cards";
import type { ResourceType } from "@/game-engine/types";

// A fixed, good-looking hand: one card per tier plus a noble.
const FAN = [
  CARD_CATALOG.find((card) => card.tier === 1 && card.points > 0),
  CARD_CATALOG.find((card) => card.tier === 3 && card.bonus === "SAPPHIRE"),
  CARD_CATALOG.find((card) => card.tier === 2 && card.bonus === "RUBY"),
].filter((card) => card != null);

const NOBLE = ACHIEVEMENT_CATALOG[2];

const SIZE = { "--card-h": "13rem", "--card-w": "9.4rem", "--noble-size": "7.2rem" } as CSSProperties;

/** Fanned cards and a noble, dealt onto the table behind the menu. */
export function CardFan({ className }: { className?: string }) {
  return (
    <div className={className} style={SIZE} aria-hidden="true">
      <div className="relative h-[16rem] w-[30rem]">
        {FAN.map((card, index) => (
          <motion.div
            key={card.id}
            className="absolute top-2 left-1/2"
            style={{ marginLeft: "-4.7rem", transformOrigin: "50% 120%" }}
            initial={{ opacity: 0, y: 60, rotate: 0 }}
            animate={{ opacity: 1, y: (index === 1 ? -14 : 8), rotate: (index - 1) * 11, x: (index - 1) * 128 }}
            transition={{ type: "spring", stiffness: 140, damping: 18, delay: 0.25 + index * 0.12 }}
          >
            <DevelopmentCard card={card} />
          </motion.div>
        ))}
        {NOBLE && (
          <motion.div
            className="absolute -top-24 right-[-3.5rem] z-10"
            initial={{ opacity: 0, scale: 0.8, rotate: 0 }}
            animate={{ opacity: 1, scale: 1, rotate: 9 }}
            transition={{ type: "spring", stiffness: 160, damping: 16, delay: 0.75 }}
          >
            <div className="float-slow">
              <NobleCard noble={NOBLE} />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/** A few chip stacks scattered on the table. */
export function ChipPile({
  types,
  className,
}: {
  types: Array<[ResourceType, number]>;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{ "--chip-size": "3.6rem" } as CSSProperties}
      aria-hidden="true"
    >
      <div className="flex items-end gap-2">
        {types.map(([type, count], index) => (
          <motion.div
            key={type}
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.6 + index * 0.1 }}
          >
            <GemToken type={type} count={count} hideCount />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
