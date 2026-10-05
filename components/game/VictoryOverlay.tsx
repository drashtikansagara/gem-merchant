"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { GemIcon } from "@/components/gems/GemIcon";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import { RESOURCE_TYPES } from "@/game-data/resources";
import { cn } from "@/lib/utils";
import type { ClientGameState } from "@/game-engine/types";

interface VictoryOverlayProps {
  state: ClientGameState;
  localPlayerId: string;
  onPlayAgain: () => void;
  onLobby: () => void;
  /** Watchers get the result but no rematch button. */
  spectator?: boolean;
}

const MEDALS = ["#dcc48a", "#cfd3d8", "#c98a4a"];

// Deterministic burst so the celebration looks the same on every render.
const BURST = Array.from({ length: 28 }, (_, index) => {
  const angle = (index / 28) * Math.PI * 2;
  const distance = 320 + ((index * 37) % 180);
  return {
    type: RESOURCE_TYPES[index % RESOURCE_TYPES.length],
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance * 0.75,
    size: 18 + ((index * 13) % 16),
    delay: (index % 7) * 0.04,
  };
});

export function VictoryOverlay({
  state,
  localPlayerId,
  onPlayAgain,
  onLobby,
  spectator = false,
}: VictoryOverlayProps) {
  const winner = state.players.find((player) => player.id === state.winnerId);
  const isWinner = state.winnerId === localPlayerId;
  const ranked = [...state.players].sort(
    (a, b) => b.points - a.points || a.cards.length - b.cards.length,
  );

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(20,12,4,0.55),rgba(0,0,0,0.85))] backdrop-blur-[3px]">
      <div className="pointer-events-none absolute top-1/2 left-1/2" aria-hidden="true">
        {BURST.map((gem, index) => (
          <motion.span
            key={index}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
            animate={{ x: gem.x, y: gem.y, opacity: [0, 1, 0.9], scale: 1, rotate: gem.x > 0 ? 200 : -200 }}
            transition={{ duration: 1.1, delay: 0.15 + gem.delay, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <GemIcon type={gem.type} size={gem.size} />
          </motion.span>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="parchment relative w-[min(30rem,92vw)] rounded-2xl px-8 py-8 text-center"
      >
        <p className="kicker !text-[#b58a32]">{isWinner ? "The table is yours" : "The final tally"}</p>
        <h2 className="mt-1 font-display text-5xl font-bold tracking-[0.12em] text-ink">
          {isWinner ? "VICTORY" : "GAME OVER"}
        </h2>
        <p className="mt-2 text-ink/70">
          {winner && state.endedByForfeit ? (
            <>
              <span className="font-display text-ink">{winner.name}</span> wins —{" "}
              <b className="text-[#8a6420]">the other merchants left the table</b>
            </>
          ) : winner ? (
            <>
              <span className="font-display text-ink">{winner.name}</span> wins with{" "}
              <b className="text-[#8a6420]">{winner.points} prestige</b>
            </>
          ) : (
            "The game has ended."
          )}
        </p>

        <div className="gold-rule mx-auto my-5 h-px w-40" />

        <ol className="space-y-2 text-left">
          {ranked.map((player, index) => (
            <motion.li
              key={player.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + index * 0.1 }}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2",
                player.id === state.winnerId
                  ? "border-[#dcc48a] bg-[#fff6dc] shadow-[0_0_18px_rgba(240,200,100,0.45)]"
                  : "border-ink/10 bg-white/50",
              )}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-numeral text-sm font-black text-[#2a1a05]"
                style={{ background: MEDALS[index] ?? "rgba(42,36,28,0.12)" }}
              >
                {index + 1}
              </span>
              <PlayerAvatar id={player.avatar} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-ink">
                  {player.name}
                  {player.id === localPlayerId && <span className="text-ink/45"> (you)</span>}
                </span>
                <span className="block text-xs text-ink/60">
                  {player.cards.length} cards · {player.achievements.length} patrons
                </span>
              </span>
              <span className="font-numeral text-3xl leading-none font-black text-[#8a6420]">
                {player.points}
              </span>
            </motion.li>
          ))}
        </ol>

        <div className="mt-7 flex justify-center gap-3">
          {!spectator && (
            <Button size="lg" onClick={onPlayAgain}>
              Play Again
            </Button>
          )}
          <Button size="lg" variant="ivory" onClick={onLobby}>
            Leave Table
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
