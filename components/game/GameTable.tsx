"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Bank } from "@/components/game/Bank";
import { GameHeader } from "@/components/game/GameHeader";
import { MarketRow } from "@/components/game/MarketRow";
import { OpponentPanel } from "@/components/game/OpponentPanel";
import { PlayerArea } from "@/components/game/PlayerArea";
import { SelectedCardPanel } from "@/components/game/SelectedCardPanel";
import { TakeGemsTray } from "@/components/game/TakeGemsTray";
import { ReturnTokensTray } from "@/components/game/ReturnTokensTray";
import { VictoryOverlay } from "@/components/game/VictoryOverlay";
import { NobleCard } from "@/components/cards/NobleCard";
import { Button } from "@/components/ui/button";
import { useNotify } from "@/components/providers/NotifyProvider";
import { allTableArt } from "@/lib/art";
import { useSound } from "@/lib/sound";
import {
  canAfford,
  eligibleNobles,
  GAME_RULES,
  hasLegalAction,
  isHiddenCard,
  missingGemsMessage,
  remainingCost,
  suggestedPayment,
  totalTokens,
} from "@/game-engine";
import type {
  Card,
  ClientGameState,
  GameAction,
  GameEvent,
  GemType,
  ResourceType,
} from "@/game-engine/types";
import { EventOverlay } from "@/components/game/EventOverlay";
import { GEM_TYPES, RESOURCE_META } from "@/game-data/resources";
import { useFitBoard } from "@/hooks/useFitBoard";
import { useStackedLayout } from "@/hooks/useStackedLayout";
import { useSecretHints } from "@/hooks/useSecretHints";
import { ArtSizeContext } from "@/components/providers/ArtSizeProvider";

interface GameTableProps {
  state: ClientGameState;
  localPlayerId: string;
  roomCode?: string;
  connection?: "ready" | "connecting" | "reconnecting";
  events?: GameEvent[];
  onAction: (action: GameAction) => string | void;
  onLeave: () => void;
  onPlayAgain: () => void;
  onLobby: () => void;
  /** Watching without a seat: read-only, and the bottom panel follows the current player. */
  spectator?: boolean;
  /** How many people are watching (shown to everyone at the table). */
  spectatorCount?: number;
}

/** "return": hand back tokens before reserving; "noble": pick which noble visits. */
type Mode = "idle" | "take" | "card" | "deck" | "return" | "noble";

export function GameTable({
  state,
  localPlayerId,
  roomCode,
  connection = "ready",
  events = [],
  onAction,
  onLeave,
  onPlayAgain,
  onLobby,
  spectator = false,
  spectatorCount = 0,
}: GameTableProps) {
  const { notify } = useNotify();
  const { hints, holding, holdProps } = useSecretHints();
  const stacked = useStackedLayout();
  const { boardRef, mainRef, artSize } = useFitBoard<HTMLDivElement, HTMLDivElement>();
  const sound = useSound();
  const [mode, setMode] = useState<Mode>("idle");
  const [selectedGems, setSelectedGems] = useState<GemType[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [discard, setDiscard] = useState<Partial<Record<ResourceType, number>>>({});
  const [selectedDeck, setSelectedDeck] = useState<1 | 2 | 3 | null>(null);
  /** An action waiting on a return-tokens or noble choice before it is sent. */
  const [pendingAction, setPendingAction] = useState<GameAction | null>(null);

  // A spectator has no seat: feature whoever is playing in the bottom panel.
  const focusId = spectator ? state.currentPlayerId : localPlayerId;
  const me = state.players.find((player) => player.id === focusId) ?? (spectator ? state.players[0] : undefined);
  const opponents = state.players.filter((player) => player.id !== me?.id);
  const current = state.players.find((player) => player.id === state.currentPlayerId);
  const yourTurn = state.currentPlayerId === localPlayerId && state.status === "PLAYING";

  // Warm the image cache so token art never pops in blank (card art is drawn in code).
  useEffect(() => {
    if (!artSize.ready) return;
    for (const src of allTableArt(artSize.chip)) {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    }
  }, [artSize.ready, artSize.chip]);

  // Escape backs out of whatever is being selected.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMode("idle");
      setSelectedGems([]);
      setSelectedCard(null);
      setSelectedDeck(null);
      setDiscard({});
      setPendingAction(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Drop any half-made selection when the turn passes.
  const turnKey = `${state.currentPlayerId}-${state.turnNumber}`;
  const [lastTurnKey, setLastTurnKey] = useState(turnKey);
  if (turnKey !== lastTurnKey) {
    setLastTurnKey(turnKey);
    setMode("idle");
    setSelectedGems([]);
    setSelectedCard(null);
    setSelectedDeck(null);
    setDiscard({});
    setPendingAction(null);
  }

  const affordableIds = useMemo(() => {
    const ids = new Set<string>();
    if (!me || spectator) {
      return ids;
    }
    const cards = [
      ...state.market.tier1,
      ...state.market.tier2,
      ...state.market.tier3,
      ...me.reservedCards,
    ];
    for (const card of cards) {
      if (card && !isHiddenCard(card) && canAfford(me, card.cost)) {
        ids.add(card.id);
      }
    }
    return ids;
  }, [me, state, spectator]);

  if (!me) {
    return (
      <div className="tabletop flex h-dvh items-center justify-center">
        Connecting to the game...
      </div>
    );
  }

  const tokenTotal = totalTokens(me.tokens);
  // Card glow is a hint: only with hints switched on, and only on your own turn.
  const glowIds = hints && yourTurn ? affordableIds : NO_IDS;
  const takeBlocked = GAME_RULES.blockTakeAtHandLimit && tokenTotal >= GAME_RULES.maxTokensInHand;
  const myBonuses = me.cards.reduce<Partial<Record<GemType, number>>>((acc, card) => {
    acc[card.bonus] = (acc[card.bonus] ?? 0) + 1;
    return acc;
  }, {});
  const playerNames = Object.fromEntries(state.players.map((player) => [player.id, player.name]));
  const mustDiscard = tokenTotal + selectedGems.length > GAME_RULES.maxTokensInHand;
  const reserveGivesRoyal = GAME_RULES.royalOnReserve && state.bank.ROYAL > 0;
  const reserveOverflow = Math.max(
    0,
    tokenTotal + (reserveGivesRoyal ? 1 : 0) - GAME_RULES.maxTokensInHand,
  );
  const deckCards = state.deckCounts.tier1 + state.deckCounts.tier2 + state.deckCounts.tier3;
  const mustPass = yourTurn && !spectator && !hasLegalAction(state, me, deckCards);

  function resetModes() {
    setMode("idle");
    setSelectedGems([]);
    setSelectedCard(null);
    setSelectedDeck(null);
    setDiscard({});
    setPendingAction(null);
  }

  /** Nobles that would qualify at the end of this action (a purchase adds its bonus). */
  function noblesAfter(action: GameAction) {
    if (!me) return [];
    const bought = action.type === "BUY_CARD" && selectedCard?.id === action.cardId ? [selectedCard] : [];
    return eligibleNobles(state.nobles, { cards: [...me.cards, ...bought] });
  }

  function submit(action: GameAction) {
    // Several nobles at once: the player chooses who visits (official rule).
    if (action.nobleId == null && noblesAfter(action).length > 1) {
      setPendingAction(action);
      setMode("noble");
      return;
    }
    const error = onAction(action);
    if (error) {
      notify(error);
      sound("error");
      return;
    }
    resetModes();
  }

  function onSelectCard(card: Card) {
    if (!yourTurn) {
      notify(spectator ? "You are watching this game." : "It is not your turn.");
      sound("error");
      return;
    }
    sound("select");
    setSelectedGems([]);
    setDiscard({});
    setSelectedDeck(null);
    setSelectedCard(card);
    setMode("card");
  }

  /**
   * Click cycle on a bank pile: select one → (if the pile has enough) take two → clear.
   * Clicking a gem starts a "take gems" turn, so no separate button press is needed.
   */
  function warnHandFull() {
    notify(
      `You already hold ${GAME_RULES.maxTokensInHand} gems — buy or reserve a card instead.`,
    );
    sound("error");
  }

  function toggleGem(gem: GemType) {
    if (!yourTurn) {
      notify(spectator ? "You are watching this game." : "It is not your turn.");
      sound("error");
      return;
    }
    if (takeBlocked) {
      warnHandFull();
      return;
    }
    if (mode !== "take") {
      setSelectedCard(null);
      setSelectedDeck(null);
      setMode("take");
    }
    const current = mode === "take" ? selectedGems : [];
    const count = current.filter((item) => item === gem).length;
    const isDouble = current.length === 2 && current[0] === current[1];
    const name = RESOURCE_META[gem].name;
    let next: GemType[] = current;

    if (current.length === 1 && count === 1) {
      if (state.bank[gem] >= GAME_RULES.takeSameMinBank) {
        next = [gem, gem];
      } else {
        next = [];
        notify(`Taking two ${name} needs at least ${GAME_RULES.takeSameMinBank} in the pile.`);
      }
    } else if (count > 0) {
      next = current.filter((item) => item !== gem);
    } else if (isDouble) {
      notify(`You're taking two ${RESOURCE_META[current[0]].name}. Click them to clear first.`);
      sound("error");
      return;
    } else if (current.length >= GAME_RULES.takeDifferentTokens) {
      notify(`You can take at most ${GAME_RULES.takeDifferentTokens} different gems.`);
      sound("error");
      return;
    } else {
      next = [...current, gem];
    }
    sound("select");
    setSelectedGems(next);
    setDiscard({});
  }

  function buySelected() {
    if (!selectedCard || !me) {
      return;
    }
    if (!canAfford(me, selectedCard.cost)) {
      notify(missingGemsMessage(me, selectedCard.cost));
      sound("error");
      return;
    }
    const payment = suggestedPayment(me, selectedCard.cost);
    if (!payment) {
      notify(missingGemsMessage(me, selectedCard.cost));
      return;
    }
    submit({ type: "BUY_CARD", cardId: selectedCard.id, payment });
  }

  /** Reserving at the hand limit: the Royal counts, so pick tokens to hand back first. */
  function reserve(action: Extract<GameAction, { type: "RESERVE_CARD" }>) {
    if (reserveOverflow > 0) {
      setDiscard({});
      setPendingAction(action);
      setMode("return");
      return;
    }
    submit(action);
  }

  function reserveDeck(tier: 1 | 2 | 3) {
    if (!yourTurn) {
      notify("It is not your turn.");
      sound("error");
      return;
    }
    if (!me || me.reservedCards.length >= GAME_RULES.maxReservedCards) {
      notify(`You already hold ${GAME_RULES.maxReservedCards} reserved cards.`);
      sound("error");
      return;
    }
    sound("select");
    setSelectedGems([]);
    setSelectedCard(null);
    setDiscard({});
    setSelectedDeck(tier);
    setMode("deck");
  }

  return (
    <MotionConfig reducedMotion="user">
    <ArtSizeContext.Provider value={artSize}>
    <div
      ref={boardRef}
      className="game-board table-dark relative h-dvh overflow-hidden"
    >
      <GameHeader
        roomCode={roomCode}
        turnNumber={state.turnNumber}
        yourTurn={yourTurn}
        currentName={current?.name ?? "Opponent"}
        finalRound={
          state.status === "PLAYING" &&
          state.players.some((player) => player.points >= GAME_RULES.victoryPoints)
        }
        spectator={spectator}
        spectatorCount={spectatorCount}
        onLeave={onLeave}
        hintHold={spectator ? undefined : { holding, props: holdProps }}
      />
      <div ref={mainRef} className="zone zone-main">
        <aside className="zone-side">
          <div className="side-opponents">
            {opponents.map((player) => (
              <OpponentPanel
                key={player.id}
                player={player}
                isCurrent={player.id === state.currentPlayerId}
                compact={opponents.length > 1}
              />
            ))}
          </div>
          {/* Wide screens: your own panel sits under the opponents, leaving the
              full height of the table to the cards. */}
          {!stacked && (
            <PlayerArea
              player={me}
              variant="side"
              selectedId={selectedCard?.id}
              affordableIds={glowIds}
              onSelectCard={onSelectCard}
            />
          )}
        </aside>
        <div className="play-mat gap-[calc(var(--card-gap)*1.2)]">
          <div className="noble-rail">
            <AnimatePresence mode="popLayout" initial>
              {state.nobles.map((noble, index) => (
                <motion.div
                  key={noble.id}
                  layout
                  initial={{ opacity: 0, y: -24, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -120, scale: 0.6, rotate: -8, transition: { duration: 0.45 } }}
                  transition={{ type: "spring", stiffness: 240, damping: 24, delay: 0.5 + index * 0.07 }}
                >
                  <NobleCard noble={noble} owned={myBonuses} hintClose={hints && !spectator} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="market-rows">
          <MarketRow
            tier={3}
            cards={state.market.tier3}
            deckCount={state.deckCounts.tier3}
            affordableIds={glowIds}
            selectedId={selectedCard?.id}
            dimUnaffordable={hints && yourTurn}
            onSelectCard={onSelectCard}
            onSelectDeck={reserveDeck}
          />
          <MarketRow
            tier={2}
            cards={state.market.tier2}
            deckCount={state.deckCounts.tier2}
            affordableIds={glowIds}
            selectedId={selectedCard?.id}
            dimUnaffordable={hints && yourTurn}
            onSelectCard={onSelectCard}
            onSelectDeck={reserveDeck}
          />
          <MarketRow
            tier={1}
            cards={state.market.tier1}
            deckCount={state.deckCounts.tier1}
            affordableIds={glowIds}
            selectedId={selectedCard?.id}
            dimUnaffordable={hints && yourTurn}
            onSelectCard={onSelectCard}
            onSelectDeck={reserveDeck}
          />
          </div>
        </div>
        <aside className="zone-bank-col">
          <p className="zone-label zone-label-light">BANK</p>
          <Bank
            bank={state.bank}
            selected={selectedGems}
            interactive={yourTurn}
            onToggle={toggleGem}
          />
        </aside>
      </div>
      <div className="zone zone-rail">
        <div className="flex items-center justify-center">
          {mode === "idle" && yourTurn && (
            <div className="action-rail flex flex-nowrap items-center gap-3 rounded-lg py-1.5 pr-1.5 pl-4">
              <p className="text-base text-ink/80">
                <b className="text-ink">Your move:</b> pick gems from the bank, or click a card to
                buy or reserve it.
              </p>
              {mustPass ? (
                <Button size="sm" onClick={() => submit({ type: "PASS" })}>
                  No legal move: Pass
                </Button>
              ) : (
                <Button size="sm" onClick={() => (takeBlocked ? warnHandFull() : setMode("take"))}>
                  Take Gems
                </Button>
              )}
            </div>
          )}
          {mode === "return" && pendingAction && (
            <ReturnTokensTray
              held={{ ...me.tokens, ROYAL: me.tokens.ROYAL + (reserveGivesRoyal ? 1 : 0) }}
              required={reserveOverflow}
              discard={discard}
              onChangeDiscard={(type, value) =>
                setDiscard((currentDiscard) => ({ ...currentDiscard, [type]: value }))
              }
              onConfirm={() =>
                pendingAction.type === "RESERVE_CARD" && submit({ ...pendingAction, discard })
              }
              onCancel={resetModes}
            />
          )}
          {mode === "noble" && pendingAction && (
            <div className="action-rail flex items-center gap-3 rounded-lg py-1.5 pr-1.5 pl-4">
              <p className="text-sm text-ink/80">
                <b>Several patrons</b> want to join you. Only one comes this turn:
              </p>
              {noblesAfter(pendingAction).map((noble) => (
                <Button
                  key={noble.id}
                  size="sm"
                  variant="ivory"
                  onClick={() => submit({ ...pendingAction, nobleId: noble.id })}
                >
                  {noble.name}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={resetModes}>
                Cancel
              </Button>
            </div>
          )}
          {!yourTurn && state.status === "PLAYING" && (
            <div className="action-rail flex items-center gap-3 rounded-lg px-5 py-2.5 text-base text-ink/80">
              <span className="waiting-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              {spectator ? "Watching" : "Waiting for"}{" "}
              <b className="font-display text-ink">{current?.name ?? "the next player"}</b>
              {spectator && " play"}
            </div>
          )}
          {mode === "deck" && selectedDeck && (
            <div className="action-rail flex items-center gap-3 rounded-lg py-1.5 pr-1.5 pl-4">
              <p className="text-sm text-ink/80">
                Reserve the <b>top card of the tier {selectedDeck} deck</b> without seeing it
                {reserveGivesRoyal ? " and take a gold coin" : ""}?
              </p>
              <Button size="sm" onClick={() => reserve({ type: "RESERVE_CARD", deckTier: selectedDeck })}>
                Reserve
              </Button>
              <Button size="sm" variant="ghost" onClick={resetModes}>
                Cancel
              </Button>
            </div>
          )}
          {mode === "take" && (
            <TakeGemsTray
              selected={selectedGems}
              mustDiscard={mustDiscard}
              discard={discard}
              available={me.tokens}
              requiredDifferent={Math.min(
                GAME_RULES.takeDifferentTokens,
                GEM_TYPES.filter((gem) => state.bank[gem] > 0).length,
              )}
              onChangeDiscard={(type, value) =>
                setDiscard((currentDiscard) => ({ ...currentDiscard, [type]: value }))
              }
              onConfirm={() =>
                submit({
                  type: "TAKE_TOKENS",
                  tokens: selectedGems,
                  discard: mustDiscard ? discard : undefined,
                })
              }
              onCancel={resetModes}
            />
          )}
          {mode === "card" && selectedCard && (
            <SelectedCardPanel
              card={selectedCard}
              canBuy={canAfford(me, selectedCard.cost)}
              canReserve={
                me.reservedCards.length < GAME_RULES.maxReservedCards &&
                !me.reservedCards.some((card) => card.id === selectedCard.id)
              }
              payment={
                canAfford(me, selectedCard.cost) ? suggestedPayment(me, selectedCard.cost) : null
              }
              missing={shortfall(me, selectedCard.cost)}
              covered={Object.fromEntries(
                GEM_TYPES.map((gem) => [gem, Math.min(selectedCard.cost[gem] ?? 0, myBonuses[gem] ?? 0)]),
              )}
              reserveGivesRoyal={reserveGivesRoyal}
              onBuy={buySelected}
              onReserve={() => reserve({ type: "RESERVE_CARD", cardId: selectedCard.id })}
              onCancel={resetModes}
            />
          )}
        </div>
      </div>
      {stacked && (
        <div className="zone zone-player">
          <PlayerArea
            player={me}
            selectedId={selectedCard?.id}
            affordableIds={glowIds}
            onSelectCard={onSelectCard}
          />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 z-30">
        <EventOverlay
          events={events}
          localPlayerId={spectator ? undefined : localPlayerId}
          playerNames={playerNames}
          players={state.players}
        />
        {state.status === "FINISHED" && (
          <div className="pointer-events-auto">
            <VictoryOverlay
              state={state}
              localPlayerId={localPlayerId}
              onPlayAgain={onPlayAgain}
              onLobby={onLobby}
              spectator={spectator}
            />
          </div>
        )}
        {connection !== "ready" && (
          <div className="flex h-full items-center justify-center bg-ink/20">
            <p className="font-display text-2xl text-gold">
              {connection === "reconnecting"
                ? "Connection interrupted. Reconnecting..."
                : "Connecting to the game..."}
            </p>
          </div>
        )}
      </div>
    </div>
    </ArtSizeContext.Provider>
    </MotionConfig>
  );
}

/**
 * Gems still missing per colour once bonuses, held gems and wild Royals are used.
 * Royals are spent on the first short colours so the panel shows what to go and get.
 */
function shortfall(
  player: ClientGameState["players"][number],
  cost: Card["cost"],
): Partial<Record<GemType, number>> {
  const remaining = remainingCost(player, cost);
  let royals = player.tokens.ROYAL;
  const missing: Partial<Record<GemType, number>> = {};
  for (const gem of GEM_TYPES) {
    let short = Math.max(0, remaining[gem] - player.tokens[gem]);
    const covered = Math.min(short, royals);
    royals -= covered;
    short -= covered;
    if (short > 0) missing[gem] = short;
  }
  return missing;
}

const NO_IDS = new Set<string>();
