"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { GAME_RULES } from "@/game-engine";
import { AVATARS } from "@/game-data/resources";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import { useNotify } from "@/components/providers/NotifyProvider";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

const SAVED_KEY = "gm-last-identity";
const noSubscribe = () => () => undefined;

function readSavedRaw(): string {
  try {
    return localStorage.getItem(SAVED_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Last name/crest used in this browser (empty on the server and first visit). */
function useSavedIdentity(): { name: string; avatar: string } {
  const raw = useSyncExternalStore(noSubscribe, readSavedRaw, () => "");
  try {
    const parsed = raw ? (JSON.parse(raw) as { name?: string; avatar?: string }) : {};
    const avatar = AVATARS.includes(parsed.avatar as (typeof AVATARS)[number])
      ? (parsed.avatar as string)
      : AVATARS[0];
    return { name: parsed.name ?? "", avatar };
  } catch {
    return { name: "", avatar: AVATARS[0] };
  }
}

function saveIdentity(name: string, avatar: string) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify({ name, avatar }));
  } catch {
    // Private mode or storage blocked: just don't remember.
  }
}

export interface LobbyPlayer {
  id: string;
  name: string;
  avatar: string;
  ready: boolean;
  connected: boolean;
}

interface IdentityFormProps {
  title: string;
  subtitle?: string;
  submitLabel: string;
  extra?: ReactNode;
  /** Crests already used at this table: shown as taken, and skipped for the default. */
  takenAvatars?: string[];
  onSubmit: (input: { name: string; avatar: string }) => Promise<void> | void;
}

export function IdentityForm({
  title,
  subtitle,
  submitLabel,
  extra,
  takenAvatars = [],
  onSubmit,
}: IdentityFormProps) {
  // Remembered from the last table this browser sat at; typed values win.
  const saved = useSavedIdentity();
  const [typedName, setName] = useState<string | null>(null);
  const [pickedAvatar, setAvatar] = useState<string | null>(null);
  const name = typedName ?? saved.name;
  const defaultAvatar = takenAvatars.includes(saved.avatar)
    ? (AVATARS.find((id) => !takenAvatars.includes(id)) ?? saved.avatar)
    : saved.avatar;
  const avatar = pickedAvatar ?? defaultAvatar;
  const [pending, setPending] = useState(false);

  return (
    <motion.form
      className="parchment w-full max-w-md rounded-2xl px-7 py-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending || name.trim().length < 1) return;
        setPending(true);
        saveIdentity(name.trim(), avatar);
        try {
          await onSubmit({ name: name.trim(), avatar });
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="text-center font-display text-3xl text-ink">{title}</h2>
      {subtitle && <p className="mt-1 text-center text-sm text-ink/60">{subtitle}</p>}
      <div className="gold-rule mx-auto my-5 h-px w-32" />

      <label className="block">
        <span className="zone-label">YOUR NAME</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value.slice(0, 20))}
          className="field mt-2 font-display text-xl"
          maxLength={20}
          placeholder="e.g. Amara"
          autoFocus
          required
        />
      </label>

      <p className="zone-label mt-6">YOUR CREST</p>
      <div className="mt-2 grid grid-cols-8 gap-1.5">
        {AVATARS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setAvatar(id)}
            aria-pressed={avatar === id}
            aria-label={`Crest ${id.replace(/\D/g, "")}${takenAvatars.includes(id) ? " (taken)" : ""}`}
            title={takenAvatars.includes(id) ? "Already used at this table" : undefined}
            className={cn(
              "focus-ring flex aspect-square items-center justify-center rounded-full transition-transform",
              avatar === id
                ? "scale-110 shadow-[0_0_0_3px_#dcc48a,0_4px_10px_rgba(0,0,0,0.25)]"
                : takenAvatars.includes(id)
                  ? "opacity-25 grayscale hover:opacity-50"
                  : "opacity-70 hover:scale-105 hover:opacity-100",
            )}
          >
            <PlayerAvatar id={id} size={38} />
          </button>
        ))}
      </div>

      {extra}

      <Button
        type="submit"
        size="lg"
        className="mt-8 w-full"
        disabled={pending || name.trim().length < 1}
      >
        {pending ? "Preparing the table…" : submitLabel}
      </Button>
    </motion.form>
  );
}

interface LobbyTableProps {
  roomCode: string;
  hostPlayerId: string;
  localPlayerId: string;
  players: LobbyPlayer[];
  maxPlayers?: number;
  spectatorCount?: number;
  onReady: () => void;
  onStart: () => void;
  onLeave: () => void;
}

export function LobbyTable({
  roomCode,
  hostPlayerId,
  localPlayerId,
  players,
  maxPlayers = GAME_RULES.maximumPlayers,
  spectatorCount = 0,
  onReady,
  onStart,
  onLeave,
}: LobbyTableProps) {
  const { notify } = useNotify();
  const invite =
    typeof window !== "undefined"
      ? `${window.location.origin}/game/${roomCode}`
      : `/game/${roomCode}`;
  const you = players.find((player) => player.id === localPlayerId);
  const isHost = localPlayerId === hostPlayerId;
  const enough = players.length >= GAME_RULES.minimumPlayers;
  const allReady = players.every((player) => player.ready);
  const canStart = isHost && enough && allReady;
  const emptySeats = Math.max(0, maxPlayers - players.length);

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value).then(
      () => notify(`${label} copied`),
      () => notify(`Could not copy the ${label.toLowerCase()}`),
    );
  };

  return (
    <motion.div
      className="parchment w-full max-w-lg rounded-2xl px-7 py-8 text-center"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="zone-label">ROOM CODE</p>
      <div className="mt-3 flex justify-center gap-1.5" aria-label={`Room ${roomCode}`}>
        {roomCode.split("").map((char, index) => (
          <span key={index} className="code-tile">
            {char}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="ivory" onClick={() => copy(roomCode, "Code")}>
          Copy Code
        </Button>
        <Button size="sm" variant="ivory" onClick={() => copy(invite, "Invite link")}>
          Copy Invite Link
        </Button>
        <Button size="sm" variant="ivory" onClick={() => copy(`${invite}?watch=1`, "Watch link")}>
          Copy Watch Link
        </Button>
      </div>

      <div className="gold-rule mx-auto my-6 h-px w-40" />

      <p className="zone-label">
        PLAYERS · {players.length} / {maxPlayers}
        {spectatorCount > 0 && (
          <span className="text-ink/50">
            {" "}
            · {spectatorCount} watching
          </span>
        )}
      </p>
      <ul className="mt-3 space-y-2 text-left">
        {players.map((player) => (
          <motion.li
            key={player.id}
            layout
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "flex items-center justify-between rounded-xl border bg-white/55 px-3 py-2",
              player.ready ? "border-[#2f9e57]/40" : "border-ink/10",
            )}
          >
            <span className="flex items-center gap-3">
              <PlayerAvatar id={player.avatar} size={36} />
              <span>
                <span className="block font-display text-ink">
                  {player.name}
                  {player.id === localPlayerId && <span className="text-ink/45"> (you)</span>}
                </span>
                {player.id === hostPlayerId && (
                  <span className="block text-[0.62rem] tracking-[0.16em] text-gold">HOST</span>
                )}
              </span>
            </span>
            <StatusPill player={player} />
          </motion.li>
        ))}
        {Array.from({ length: emptySeats }, (_, index) => (
          <li
            key={`empty-${index}`}
            className="flex items-center gap-3 rounded-xl border border-dashed border-ink/20 px-3 py-2 text-ink/45"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-ink/25">
              +
            </span>
            <span className="text-sm">Open seat — share the code</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-sm text-ink/65">
        {!enough
          ? "Waiting for at least one more merchant…"
          : !allReady
            ? "Everyone must press Ready."
            : isHost
              ? "All set — start when you like."
              : "Waiting for the host to start."}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Button variant={you?.ready ? "ivory" : "gold"} onClick={onReady}>
          {you?.ready ? "Not Ready" : "Ready"}
        </Button>
        {isHost && (
          <Button onClick={onStart} disabled={!canStart}>
            Start Game
          </Button>
        )}
        <Button variant="ghost" onClick={onLeave}>
          Leave
        </Button>
      </div>
    </motion.div>
  );
}

function StatusPill({ player }: { player: LobbyPlayer }) {
  if (!player.connected) {
    return <span className="status-pill bg-ink/10 text-ink/55">AWAY</span>;
  }
  if (player.ready) {
    return <span className="status-pill bg-[#2f9e57]/15 text-[#1f7a41]">✓ READY</span>;
  }
  return <span className="status-pill bg-[#dcc48a]/25 text-[#8a6420]">SEATED</span>;
}

export function CreateLobbyForm({ initialPlayers = 2 }: { initialPlayers?: number }) {
  const router = useRouter();
  const { notify } = useNotify();
  const [players, setPlayers] = useState(
    Math.min(GAME_RULES.maximumPlayers, Math.max(GAME_RULES.minimumPlayers, initialPlayers)),
  );
  const counts = Array.from(
    { length: GAME_RULES.maximumPlayers - GAME_RULES.minimumPlayers + 1 },
    (_, index) => GAME_RULES.minimumPlayers + index,
  );

  return (
    <IdentityForm
      title="Create a Table"
      subtitle="Pick your name and crest, then invite your rivals."
      submitLabel="Create Game"
      extra={
        <div className="mt-6">
          <p className="zone-label">PLAYERS</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {counts.map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={players === count}
                onClick={() => setPlayers(count)}
                className="choice-tile focus-ring flex flex-col items-center gap-1 py-2.5"
              >
                <span className="font-numeral text-2xl leading-none font-black text-ink">{count}</span>
                <span className="flex -space-x-1.5">
                  {Array.from({ length: count }, (_, index) => (
                    <PlayerAvatar key={index} id={AVATARS[index * 2]} size={16} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      }
      onSubmit={async ({ name, avatar }) => {
        const res = await fetch("/api/games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            avatar,
            maxPlayers: players,
          }),
        });
        const body = (await res.json()) as { roomCode?: string; error?: string };
        if (!res.ok || !body.roomCode) {
          notify(body.error ?? "The table could not be prepared.");
          return;
        }
        sessionStorage.setItem(
          "gm-identity",
          JSON.stringify({ name, avatar }),
        );
        router.push(`/game/${body.roomCode}`);
      }}
    />
  );
}
