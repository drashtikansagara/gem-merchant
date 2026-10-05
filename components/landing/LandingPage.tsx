"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GAME_CONFIG } from "@/lib/config";
import { GAME_RULES } from "@/game-engine";
import { Button } from "@/components/ui/button";
import { GemIcon } from "@/components/gems/GemIcon";
import { CardFan, ChipPile } from "@/components/landing/Showcase";
import { GEM_TYPES } from "@/game-data/resources";
import { fetchRoomPreview, seatProblem } from "@/lib/roomPreview";

type Screen = "home" | "join";

const PANEL = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.22 },
};

export function LandingPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("home");
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  // The code is real but there's no seat: offer to spectate.
  const [watchable, setWatchable] = useState(false);
  const [checking, setChecking] = useState(false);
  const cleanCode = code.replace(/[^A-Z0-9]/g, "");

  async function joinTable() {
    if (cleanCode.length < 4 || checking) return;
    setChecking(true);
    setJoinError(null);
    const result = await fetchRoomPreview(cleanCode);
    const problem = result.ok ? seatProblem(result.room) : result.error;
    if (problem) {
      setJoinError(problem);
      setWatchable(result.ok);
      setChecking(false);
      return;
    }
    router.push(`/game/${cleanCode}`);
  }

  return (
    <div className="tabletop relative min-h-dvh overflow-x-hidden">
      <FloatingGems />
      <main className="relative mx-auto grid min-h-dvh max-w-6xl items-center gap-12 px-6 py-12 md:grid-cols-[1.05fr_1fr]">
        <section className="flex flex-col items-center text-center md:items-start md:text-left">
          <motion.p
            className="kicker"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            A tabletop of gems & patrons
          </motion.p>
          <motion.h1
            className="gold-title mt-3 font-display text-6xl leading-[0.95] font-bold tracking-[0.04em] md:text-8xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {GAME_CONFIG.name.split(" ").map((word) => (
              <span key={word} className="block">
                {word}
              </span>
            ))}
          </motion.h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-[#f3ead8]/80">
            Collect gems, buy mines, ships and palaces, and win the favour of patrons.
            First to {GAME_RULES.victoryPoints} prestige takes the table.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
            {[
              `${GAME_RULES.minimumPlayers}–${GAME_RULES.maximumPlayers} players`,
              "≈ 30 minutes",
              "Online or same screen",
            ].map((fact) => (
              <span
                key={fact}
                className="rounded-full border border-[#dcc48a]/30 bg-black/20 px-3 py-1 text-xs tracking-[0.08em] text-[#f3ead8]/85"
              >
                {fact}
              </span>
            ))}
          </div>

          <div className="parchment mt-8 w-full max-w-sm rounded-2xl p-6">
            <AnimatePresence mode="wait" initial={false}>
              {screen === "home" ? (
                <motion.div key="home" {...PANEL} className="flex flex-col gap-3">
                  <Button size="lg" className="w-full" onClick={() => router.push("/lobby?mode=create")}>
                    Create Game
                  </Button>
                  <Button size="lg" variant="ivory" className="w-full" onClick={() => setScreen("join")}>
                    Join Game
                  </Button>
                  <div className="mt-1 rounded-lg border border-ink/10 bg-white/40 px-4 py-3">
                    <span className="block font-display text-sm text-ink">Practice table</span>
                    <span className="block text-xs text-ink/60">Pass & play on one screen</span>
                    <div className="mt-2 flex gap-1.5">
                      {[2, 3, 4].map((count) => (
                        <Link
                          key={count}
                          href={`/game/local?players=${count}`}
                          className="focus-ring flex-1 rounded-md border border-ink/15 bg-white/60 py-1.5 text-center text-xs font-semibold tracking-[0.08em] text-ink/80 transition-colors hover:border-gold hover:bg-[#fff6dc] hover:text-ink"
                        >
                          {count} players
                        </Link>
                      ))}
                    </div>
                  </div>
                  <Link
                    href="/how-to-play"
                    className="mt-1 text-center text-sm tracking-[0.14em] text-ink/60 underline-offset-4 hover:text-gold hover:underline"
                  >
                    How to play
                  </Link>
                </motion.div>
              ) : (
                <motion.form
                  key="join"
                  {...PANEL}
                  className="flex flex-col"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void joinTable();
                  }}
                >
                  <p className="zone-label text-center">ENTER THE ROOM CODE</p>
                  <input
                    autoFocus
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value.toUpperCase().slice(0, 6));
                      setJoinError(null);
                      setWatchable(false);
                    }}
                    className="field mt-3 text-center font-display text-3xl tracking-[0.4em] uppercase"
                    placeholder="ABC123"
                    maxLength={6}
                    aria-label="Room code"
                  />
                  {joinError ? (
                    <p role="alert" className="mt-2 text-center text-sm font-semibold text-[#a4461d]">
                      {joinError}
                    </p>
                  ) : (
                    <p className="mt-2 text-center text-xs text-ink/55">
                      Ask the host for the 6-letter code, or open their invite link.
                    </p>
                  )}
                  <Button
                    type="submit"
                    size="lg"
                    className="mt-5 w-full"
                    disabled={cleanCode.length < 4 || checking}
                  >
                    {checking ? "Finding the table…" : "Join Game"}
                  </Button>
                  {watchable ? (
                    <Button
                      type="button"
                      variant="ivory"
                      className="mt-2 w-full"
                      onClick={() => router.push(`/game/${cleanCode}?watch=1`)}
                    >
                      Watch Instead
                    </Button>
                  ) : (
                    <button
                      type="button"
                      disabled={cleanCode.length < 4}
                      onClick={() => router.push(`/game/${cleanCode}?watch=1`)}
                      className="mt-2 text-center text-xs text-ink/55 underline-offset-2 hover:text-[#8a6420] hover:underline disabled:invisible"
                    >
                      Just watch this table
                    </button>
                  )}
                  <Button type="button" variant="ghost" className="mt-1" onClick={() => setScreen("home")}>
                    Back
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </section>

        <section className="relative hidden h-[30rem] items-center justify-center md:flex">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(214,196,150,0.06),transparent_65%)]" />
          <CardFan className="relative" />
          <ChipPile
            className="absolute bottom-0 left-0"
            types={[
              ["RUBY", 4],
              ["EMERALD", 2],
              ["ROYAL", 3],
            ]}
          />
          <ChipPile
            className="absolute right-2 bottom-0"
            types={[
              ["SAPPHIRE", 3],
              ["PEARL", 5],
            ]}
          />
        </section>
      </main>
    </div>
  );
}

function FloatingGems() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {GEM_TYPES.map((gem, index) => (
        <motion.div
          key={gem}
          className="absolute"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: [0, -14, 0], opacity: 0.35 }}
          transition={{
            duration: 7 + index,
            repeat: Infinity,
            delay: index * 0.4,
          }}
          style={{
            left: `${6 + index * 16}%`,
            top: `${10 + (index % 3) * 34}%`,
          }}
        >
          <GemIcon type={gem} size={22 + (index % 3) * 6} />
        </motion.div>
      ))}
    </div>
  );
}
