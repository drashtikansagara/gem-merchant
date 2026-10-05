import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { DevelopmentCard } from "@/components/cards/DevelopmentCard";
import { NobleCard } from "@/components/cards/NobleCard";
import { GemToken } from "@/components/gems/GemToken";
import { ACHIEVEMENT_CATALOG } from "@/game-data/achievements";
import { CARD_CATALOG } from "@/game-data/cards";
import { GAME_CONFIG } from "@/lib/config";
import { GAME_RULES } from "@/game-engine";

const PIECES = {
  "--card-h": "11rem",
  "--card-w": "7.9rem",
  "--noble-size": "7rem",
  "--chip-size": "3rem",
} as CSSProperties;

const SAMPLE_CARD =
  CARD_CATALOG.find((card) => card.tier === 2 && card.points === 2 && Object.keys(card.cost).length >= 2) ??
  CARD_CATALOG[0];
const RESERVED_CARD = CARD_CATALOG.find((card) => card.tier === 3) ?? CARD_CATALOG[0];
const SAMPLE_NOBLE = ACHIEVEMENT_CATALOG[0];

export default function HowToPlayPage() {
  return (
    <div className="tabletop min-h-dvh overflow-x-hidden" style={PIECES}>
      <header className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="gold-title font-display text-xl font-bold tracking-[0.04em]">
          {GAME_CONFIG.name}
        </Link>
        <Link href="/" className="text-sm tracking-[0.14em] text-[#f3ead8]/65 hover:text-[#dcc48a]">
          ← Back to the table
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-16">
        <p className="kicker text-center">The rules in two minutes</p>
        <h1 className="gold-title mt-2 text-center font-display text-5xl font-bold md:text-6xl">
          How to Play
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-[#f3ead8]/80">
          You are a gem merchant. Collect stones, buy developments that make future purchases
          cheaper, and win the favour of nobles. The first to{" "}
          <strong className="text-[#dcc48a]">{GAME_RULES.victoryPoints} prestige</strong> ends
          the game once the round is complete.
        </p>

        <p className="kicker mt-12 mb-4 text-center">On your turn, do one thing</p>
        <div className="grid gap-5 md:grid-cols-3">
          <Rule step="1" title="Take gems" visual={<TakeGemsVisual />}>
            Take <b>{GAME_RULES.takeDifferentTokens} different</b> gems, or{" "}
            <b>{GAME_RULES.takeSameTokens} of the same</b> colour if that pile still has at least{" "}
            {GAME_RULES.takeSameMinBank}.
          </Rule>
          <Rule step="2" title="Buy a card" visual={<DevelopmentCard card={SAMPLE_CARD} />}>
            Pay the coloured cost on the left. You keep the card: it scores its{" "}
            <b>points</b> and gives a permanent <b>gem bonus</b> (top right).
          </Rule>
          <Rule step="3" title="Reserve a card" visual={<ReserveVisual />}>
            Hold a card for later and take a <b>gold</b> coin — it is wild. You may keep up
            to {GAME_RULES.maxReservedCards} reserved cards.
          </Rule>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Rule title="Bonuses snowball" visual={<BonusVisual />}>
            Every card you own counts as one gem of its colour, forever. Build bonuses early and
            the big 4–5 point cards become cheap — or even free.
          </Rule>
          <Rule title="Patrons join you" visual={<NobleCard noble={SAMPLE_NOBLE} />}>
            When your <b>card bonuses</b> match a patron&apos;s requirements (the squares), they
            join you automatically for <b>{SAMPLE_NOBLE.points} prestige</b>. No action needed. Only
            one patron joins per turn; if several qualify, you choose.
          </Rule>
        </div>

        <div className="parchment mt-5 flex flex-col items-center gap-4 rounded-2xl px-6 py-5 md:flex-row md:justify-between">
          <div>
            <h2 className="font-display text-xl text-ink">The hand limit</h2>
            <p className="mt-1 text-ink/75">
              You can hold at most <b>{GAME_RULES.maxTokensInHand} gems</b>. If a turn would take
              you over, return the extras to the bank. Holding {GAME_RULES.maxTokensInHand}{" "}
              already? You can&apos;t take more: buy or reserve a card instead.
            </p>
          </div>
          <div className="flex items-end gap-1" style={{ "--chip-size": "2.2rem" } as CSSProperties}>
            {(["RUBY", "SAPPHIRE", "EMERALD", "ONYX", "PEARL"] as const).map((type) => (
              <GemToken key={type} type={type} count={2} hideCount />
            ))}
          </div>
        </div>

        <div className="mt-12 flex justify-center gap-3">
          <Link
            href="/game/local?players=2"
            className="rounded-sm border border-[#8a6420] bg-gradient-to-b from-[#cdb98c] to-[#b58a32] px-8 py-3 text-sm font-semibold tracking-[0.14em] text-[#2a1a05] uppercase shadow-[0_2px_6px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.5)] hover:from-[#f0d17f]"
          >
            Try a practice game
          </Link>
          <Link
            href="/lobby?mode=create"
            className="rounded-sm border border-[#f3ead8]/30 px-8 py-3 text-sm font-semibold tracking-[0.14em] text-[#f3ead8] uppercase hover:bg-white/10"
          >
            Create a table
          </Link>
        </div>
      </main>
    </div>
  );
}

function Rule({
  step,
  title,
  visual,
  children,
}: {
  step?: string;
  title: string;
  visual: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="parchment flex flex-col rounded-2xl p-5">
      <div className="flex items-center gap-3">
        {step && (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b from-[#cdb98c] to-[#b58a32] font-numeral text-lg font-black text-[#2a1a05] shadow">
            {step}
          </span>
        )}
        <h2 className="font-display text-xl text-ink">{title}</h2>
      </div>
      <div className="my-4 flex min-h-[11.5rem] items-center justify-center rounded-xl bg-[linear-gradient(rgba(16,58,42,0.92),rgba(10,42,30,0.95))] p-3 shadow-[inset_0_4px_16px_rgba(0,0,0,0.35)]">
        {visual}
      </div>
      <p className="text-[0.95rem] leading-relaxed text-ink/80">{children}</p>
    </section>
  );
}

function TakeGemsVisual() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-end gap-1.5">
        <GemToken type="RUBY" count={1} hideCount />
        <GemToken type="SAPPHIRE" count={1} hideCount />
        <GemToken type="EMERALD" count={1} hideCount />
      </div>
      <span className="text-[0.65rem] font-semibold tracking-[0.3em] text-[#dcc48a]">OR</span>
      <div className="flex items-end gap-1.5">
        <GemToken type="PEARL" count={1} hideCount />
        <GemToken type="PEARL" count={1} hideCount />
      </div>
    </div>
  );
}

function ReserveVisual() {
  return (
    <div className="flex items-center gap-3">
      <div className="-rotate-6">
        <DevelopmentCard card={RESERVED_CARD} reserved />
      </div>
      <span className="text-2xl text-[#dcc48a]">+</span>
      <GemToken type="ROYAL" count={1} hideCount />
    </div>
  );
}

function BonusVisual() {
  const tier1 = CARD_CATALOG.filter((card) => card.tier === 1);
  const rubies = tier1.filter((card) => card.bonus === "RUBY");
  const owned = [rubies[0], rubies[1], tier1.find((card) => card.bonus === "SAPPHIRE")].filter(
    (card) => card != null,
  );
  return (
    <div className="flex items-center" style={{ "--card-h": "8rem", "--card-w": "5.8rem" } as CSSProperties}>
      {owned.map((card, index) => (
        <div key={card.id} className={index > 0 ? "-ml-8" : ""} style={{ transform: `rotate(${(index - 1) * 6}deg)` }}>
          <DevelopmentCard card={card} />
        </div>
      ))}
    </div>
  );
}
