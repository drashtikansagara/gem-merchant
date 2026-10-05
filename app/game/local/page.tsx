"use client";

import { GameTable } from "@/components/game/GameTable";
import { useLocalGame } from "@/hooks/useLocalGame";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LocalTable() {
  const router = useRouter();
  const params = useSearchParams();
  const players = Number(params.get("players") ?? 2);
  const game = useLocalGame(Number.isFinite(players) ? players : 2);

  return (
    <GameTable
      state={game.view}
      localPlayerId={game.viewerId}
      roomCode="PRACTICE"
      events={game.lastEvents}
      onAction={game.dispatch}
      onLeave={() => router.push("/")}
      onPlayAgain={() => game.restart()}
      onLobby={() => router.push("/")}
    />
  );
}

export default function LocalGamePage() {
  return (
    <Suspense
      fallback={
        <div className="tabletop flex h-dvh items-center justify-center font-display text-2xl text-gold">
          Preparing your table...
        </div>
      }
    >
      <LocalTable />
    </Suspense>
  );
}
