"use client";

import { CreateLobbyForm } from "@/components/lobby/LobbyView";
import { CardFan } from "@/components/landing/Showcase";
import { GAME_CONFIG } from "@/lib/config";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LobbyInner() {
  const params = useSearchParams();
  const players = Number(params.get("players") ?? 2);

  return (
    <div className="tabletop min-h-dvh overflow-x-hidden">
      <header className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="gold-title font-display text-xl font-bold tracking-[0.04em]">
          {GAME_CONFIG.name}
        </Link>
        <Link href="/" className="text-sm tracking-[0.14em] text-[#f3ead8]/65 hover:text-[#dcc48a]">
          ← Back
        </Link>
      </header>
      <main className="mx-auto grid max-w-5xl items-center gap-12 px-6 pt-4 pb-12 lg:grid-cols-[1fr_auto]">
        <div className="flex justify-center">
          <CreateLobbyForm initialPlayers={Number.isFinite(players) ? players : 2} />
        </div>
        <CardFan className="hidden lg:block" />
      </main>
    </div>
  );
}

export default function LobbyPage() {
  return (
    <Suspense
      fallback={
        <div className="tabletop flex h-dvh items-center justify-center font-display text-2xl text-[#dcc48a]">
          Preparing your table…
        </div>
      }
    >
      <LobbyInner />
    </Suspense>
  );
}
