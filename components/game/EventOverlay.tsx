"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { ACHIEVEMENT_CATALOG } from "@/game-data/achievements";
import { GemIcon } from "@/components/gems/GemIcon";
import { DevelopmentCard } from "@/components/cards/DevelopmentCard";
import { isHiddenCard } from "@/game-engine/hidden";
import { deckBackSrc, tokenArtSrc } from "@/lib/art";
import { useSound } from "@/lib/sound";
import type { CSSProperties } from "react";
import type { Card, ClientPlayerState, GameEvent, ResourceType } from "@/game-engine/types";

/** Card size for cards flying across the table (independent of the board fit). */
const FLYING_CARD = { "--card-h": "9rem", "--card-w": "6.5rem" } as CSSProperties;

interface EventOverlayProps {
  events: GameEvent[];
  localPlayerId?: string;
  playerNames?: Record<string, string>;
  /** Used to find the card that moved, so the flying card shows its real face. */
  players?: ClientPlayerState[];
}

/** Where things land on screen: the local player's plaque, or the opponents' column. */
function destination(playerId: string | undefined, localPlayerId: string | undefined) {
  return playerId && playerId === localPlayerId
    ? { x: "0vw", y: "40vh" }
    : { x: "-34vw", y: "-12vh" };
}

export function EventOverlay({
  events,
  localPlayerId,
  playerNames = {},
  players = [],
}: EventOverlayProps) {
  const sound = useSound();

  useEffect(() => {
    for (const event of events) {
      if (event.type === "TOKENS_TAKEN") sound("token");
      if (event.type === "CARD_PURCHASED") sound("buy");
      if (event.type === "CARD_RESERVED") sound("reserve");
      if (event.type === "ACHIEVEMENT_CLAIMED") sound("noble");
      if (event.type === "TURN_CHANGED") sound("turn");
      if (event.type === "GAME_FINISHED") sound("victory");
    }
  }, [events, sound]);

  if (events.length === 0) {
    return null;
  }

  const tokens = events.find((event) => event.type === "TOKENS_TAKEN");
  const returned = events.find((event) => event.type === "TOKENS_RETURNED");
  const purchase = events.find((event) => event.type === "CARD_PURCHASED");
  const reserved = events.find((event) => event.type === "CARD_RESERVED");
  const noble = events.find((event) => event.type === "ACHIEVEMENT_CLAIMED");
  const turn = events.find((event) => event.type === "TURN_CHANGED");
  const findCard = (cardId: string | undefined): Card | null => {
    if (!cardId) return null;
    for (const player of players) {
      const owned = [...player.cards, ...player.reservedCards].find((card) => card.id === cardId);
      if (owned && !isHiddenCard(owned)) return owned;
    }
    return null;
  };
  const boughtCard = purchase?.type === "CARD_PURCHASED" ? findCard(purchase.cardId) : null;
  const reservedCard = reserved?.type === "CARD_RESERVED" ? findCard(reserved.cardId) : null;
  const stamp = events.map((event) => event.type).join("-");

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <AnimatePresence>
        {turn && turn.type === "TURN_CHANGED" && (
          <motion.div
            key={`turn-${stamp}-${turn.turnNumber}`}
            className="absolute inset-x-0 top-[9%] flex justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.1, times: [0, 0.15, 0.7, 1], delay: 0.4 }}
          >
            <motion.div
              className="turn-ribbon px-10 py-2.5 text-center"
              initial={{ scaleX: 0.3 }}
              animate={{ scaleX: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.4 }}
            >
              <p className="font-display text-xl tracking-[0.12em] text-[#fdf3d6]">
                {turn.playerId === localPlayerId
                  ? "Your turn"
                  : `${playerNames[turn.playerId] ?? "Next player"}'s turn`}
              </p>
              {turn.playerId === localPlayerId && playerNames[turn.playerId] && (
                <p className="text-[0.62rem] tracking-[0.2em] text-[#dcc48a]/85 uppercase">
                  {playerNames[turn.playerId]}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
        {tokens && tokens.type === "TOKENS_TAKEN" && (
          <div key={`tokens-${stamp}`} className="absolute top-1/2 left-1/2">
            {tokens.tokens.map((gem, index) => {
              const to = destination(tokens.playerId, localPlayerId);
              return (
                <motion.span
                  key={`${gem}-${index}`}
                  className="absolute -top-6 -left-6 block h-12 w-12 overflow-hidden rounded-full shadow-[0_8px_14px_rgba(0,0,0,0.45)]"
                  initial={{ x: "31vw", y: `${(index - 1) * 9}vh`, opacity: 0, scale: 0.7 }}
                  animate={{
                    x: ["31vw", "18vw", to.x],
                    y: [`${(index - 1) * 9}vh`, "-6vh", to.y],
                    opacity: [0, 1, 1, 0],
                    scale: [0.7, 1.1, 0.8],
                    rotate: [0, 180, 360],
                  }}
                  transition={{ duration: 0.75, delay: index * 0.08, ease: [0.4, 0, 0.2, 1] }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={tokenArtSrc(gem, 128)} alt="" className="card-art-img" />
                </motion.span>
              );
            })}
          </div>
        )}
        {returned && returned.type === "TOKENS_RETURNED" && (
          <motion.div
            key={`return-${stamp}`}
            className="absolute bottom-[18%] left-1/2 flex -translate-x-1/2 gap-2"
            initial={{ y: 0, opacity: 0.9, scale: 1 }}
            animate={{ y: -80, opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.36 }}
          >
            {Object.entries(returned.tokens).flatMap(([gem, count]) =>
              Array.from({ length: count ?? 0 }, (_, index) => (
                <GemIcon
                  key={`${gem}-${index}`}
                  type={gem as ResourceType}
                  size={22}
                />
              )),
            )}
          </motion.div>
        )}
        {purchase && purchase.type === "CARD_PURCHASED" && (
          <motion.div
            key={`buy-${stamp}`}
            className="absolute top-1/2 left-1/2 -mt-[4.5rem] -ml-[3.25rem] rounded-[0.5rem] shadow-[0_0_28px_rgba(240,200,100,0.75)]"
            style={FLYING_CARD}
            initial={{ x: 0, y: "-10vh", opacity: 0, scale: 1.15 }}
            animate={{
              x: [0, 0, destination(purchase.playerId, localPlayerId).x],
              y: ["-10vh", "-12vh", destination(purchase.playerId, localPlayerId).y],
              opacity: [0, 1, 1, 0],
              scale: [1.15, 1.25, 0.45],
            }}
            transition={{ duration: 0.9, times: [0, 0.3, 1], ease: [0.4, 0, 0.2, 1] }}
          >
            {boughtCard ? (
              <DevelopmentCard card={boughtCard} />
            ) : (
              <div className="h-[9rem] w-[6.5rem] rounded-[0.5rem] border-[3px] border-white bg-gradient-to-b from-[#fbf6ec] to-[#e9dcc2]" />
            )}
          </motion.div>
        )}
        {reserved && reserved.type === "CARD_RESERVED" && (
          <motion.div
            key={`reserve-${stamp}`}
            className="absolute top-1/2 left-1/2 -mt-[4.5rem] -ml-[3.25rem] rounded-[0.5rem] shadow-[0_0_22px_rgba(240,200,100,0.6)]"
            style={FLYING_CARD}
            initial={{ opacity: 0, x: 0, y: "-10vh", rotate: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: [0, 0, destination(reserved.playerId, localPlayerId).x],
              y: ["-10vh", "-12vh", destination(reserved.playerId, localPlayerId).y],
              rotate: [0, -4, -12],
              scale: [1.1, 1.15, 0.45],
            }}
            transition={{ duration: 0.9, times: [0, 0.3, 1], ease: [0.4, 0, 0.2, 1] }}
          >
            {reservedCard ? (
              <DevelopmentCard card={reservedCard} reserved />
            ) : (
              <div
                className="mini-card h-[9rem] w-[6.5rem] rounded-[0.5rem] border-[3px] border-white bg-cover bg-center"
                style={{ backgroundImage: `url(${deckBackSrc(reserved.deckTier ?? 1)})` }}
              />
            )}
          </motion.div>
        )}
        {purchase && purchase.type === "CARD_PURCHASED" && purchase.points > 0 && (
          <motion.p
            key={`score-${stamp}`}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 font-display text-5xl text-[#dcc48a] drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]"
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: -20, opacity: [1, 0] }}
            transition={{ duration: 0.7 }}
          >
            +{purchase.points}
          </motion.p>
        )}
        {noble && noble.type === "ACHIEVEMENT_CLAIMED" && (
          <motion.div
            key={`noble-${stamp}`}
            className="absolute top-[26%] left-1/2 w-72 -translate-x-1/2 rounded-md border border-gold/50 bg-surface/95 px-5 py-4 text-center"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: [0, 1, 1, 0], scale: 1 }}
            transition={{ duration: 1.15, times: [0, 0.12, 0.78, 1] }}
          >
            <p className="text-[0.65rem] tracking-[0.2em] text-gold">
              ACHIEVEMENT UNLOCKED
            </p>
            <p className="mt-1 font-display text-2xl text-ink">
              {ACHIEVEMENT_CATALOG.find((item) => item.id === noble.achievementId)
                ?.name ?? "Patron"}
            </p>
            <p className="mt-1 font-display text-lg text-gold">+{noble.points}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
