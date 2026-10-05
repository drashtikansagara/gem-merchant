"use client";

import { GameTable } from "@/components/game/GameTable";
import { IdentityForm, LobbyTable } from "@/components/lobby/LobbyView";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useWebSocketGame } from "@/hooks/useWebSocketGame";
import { useNotify } from "@/components/providers/NotifyProvider";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { PlayerAvatar } from "@/components/game/PlayerAvatar";
import {
  fetchRoomPreview,
  seatProblem,
  type PreviewResult,
  type RoomPreview,
} from "@/lib/roomPreview";

type Identity = { name: string; avatar: string };

// useSyncExternalStore needs the same object back until storage actually
// changes; parsing afresh on every call caused an infinite render loop.
let cachedRaw: string | null = null;
let cachedIdentity: Identity | null = null;

function readIdentity(): Identity | null {
  const stored = sessionStorage.getItem("gm-identity");
  if (stored !== cachedRaw) {
    cachedRaw = stored;
    try {
      cachedIdentity = stored ? (JSON.parse(stored) as Identity) : null;
    } catch {
      cachedIdentity = null;
    }
  }
  return cachedIdentity;
}

export default function RoomGamePage() {
  return (
    <Suspense fallback={<Spinner label="Finding the table…" />}>
      <RoomGame />
    </Suspense>
  );
}

function RoomGame() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const spectate = useSearchParams().get("watch") === "1";
  if (spectate) {
    return <SpectatorView roomCode={roomCode} />;
  }
  return <SeatedView roomCode={roomCode} />;
}

/** Watch a table live without a seat. */
function SpectatorView({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const game = useWebSocketGame(roomCode.toUpperCase(), null, { spectate: true });

  if (game.joinError) {
    return <CantSit roomCode={roomCode} message={game.joinError} />;
  }
  if (!game.room) {
    return <Spinner label="Joining as a spectator…" />;
  }
  if (game.room.status === "WAITING" || !game.state) {
    const open = Math.max(0, game.room.maxPlayers - game.room.players.length);
    return (
      <div className="tabletop flex min-h-dvh items-center justify-center px-4 py-10">
        <div className="parchment w-full max-w-md rounded-2xl px-7 py-8 text-center">
          <p className="zone-label">SPECTATING · TABLE {game.room.roomCode}</p>
          <h1 className="mt-2 font-display text-3xl text-ink">Waiting for the game</h1>
          <p className="mt-2 text-sm text-ink/65">
            The board will appear here as soon as the host starts.
          </p>
          <ul className="mt-5 space-y-2 text-left">
            {game.room.players.map((player) => (
              <li
                key={player.id}
                className="flex items-center justify-between rounded-xl border border-ink/10 bg-white/55 px-3 py-2"
              >
                <span className="flex items-center gap-2.5 font-display text-ink">
                  <PlayerAvatar id={player.avatar} size={30} />
                  {player.name}
                </span>
                <span className="text-[0.62rem] font-bold tracking-[0.14em] text-ink/50">
                  {player.ready ? "✓ READY" : "SEATED"}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-center gap-2">
            {open > 0 && (
              <Button onClick={() => router.push(`/game/${game.room?.roomCode}`)}>Take a Seat</Button>
            )}
            <Button variant="ivory" onClick={() => router.push("/")}>
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <GameTable
      state={game.state}
      localPlayerId=""
      spectator
      spectatorCount={game.room.spectators ?? 0}
      roomCode={game.room.roomCode}
      connection={game.connection}
      events={game.lastEvents}
      onAction={() => "You are watching this game."}
      onLeave={() => router.push("/")}
      onPlayAgain={() => undefined}
      onLobby={() => router.push("/")}
    />
  );
}

function SeatedView({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const { notify } = useNotify();
  const storedIdentity = useSyncExternalStore(
    () => () => undefined,
    readIdentity,
    () => null,
  );
  const [identityOverride, setIdentityOverride] = useState<{
    name: string;
    avatar: string;
  } | null>(null);
  const identity = identityOverride ?? storedIdentity;

  const game = useWebSocketGame(roomCode.toUpperCase(), identity);

  // Before asking for a name, check the table exists and has a free seat.
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const needsSeat = !identity;
  useEffect(() => {
    if (!needsSeat) return;
    let cancelled = false;
    fetchRoomPreview(roomCode).then((result) => {
      if (!cancelled) setPreview(result);
    });
    return () => {
      cancelled = true;
    };
  }, [needsSeat, roomCode]);

  if (!identity && !preview) {
    return <Spinner label="Finding the table…" />;
  }

  if (!identity && preview) {
    const problem = preview.ok ? seatProblem(preview.room) : preview.error;
    if (problem) {
      return <CantSit roomCode={roomCode} message={problem} canWatch={preview.ok} />;
    }
  }

  if (!identity) {
    const room = preview?.ok ? preview.room : null;
    return (
      <div className="tabletop flex min-h-dvh items-center justify-center px-4 py-10">
        <IdentityForm
          title="Take a Seat"
          subtitle={`Joining table ${roomCode.toUpperCase()}`}
          submitLabel={room?.seated ? "Return to the Table" : "Join Game"}
          extra={room && <SeatedPreview room={room} />}
          takenAvatars={room?.players.map((player) => player.avatar)}
          onSubmit={async ({ name, avatar }) => {
            const res = await fetch(`/api/games/${roomCode}/join`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, avatar }),
            });
            const body = (await res.json()) as { error?: string };
            if (!res.ok) {
              notify(body.error ?? "That table could not be found.");
              return;
            }
            sessionStorage.setItem("gm-identity", JSON.stringify({ name, avatar }));
            setIdentityOverride({ name, avatar });
          }}
        />
      </div>
    );
  }

  if (game.joinError) {
    return (
      <CantSit
        roomCode={roomCode}
        message={game.joinError}
        canWatch={!/could not be found/i.test(game.joinError)}
      />
    );
  }

  if (!game.room || !game.playerId) {
    return (
      <Spinner
        label={
          game.connection === "reconnecting"
            ? "Connection interrupted. Reconnecting…"
            : "Connecting to the game…"
        }
      />
    );
  }

  if (game.room.status === "WAITING" || !game.state) {
    return (
      <div className="tabletop flex min-h-dvh items-center justify-center px-4 py-10">
        <LobbyTable
          roomCode={game.room.roomCode}
          hostPlayerId={game.room.hostPlayerId}
          localPlayerId={game.playerId}
          players={game.room.players}
          maxPlayers={game.room.maxPlayers}
          spectatorCount={game.room.spectators ?? 0}
          onReady={game.ready}
          onStart={game.start}
          onLeave={() => {
            game.leave();
            router.push("/");
          }}
        />
      </div>
    );
  }

  return (
    <GameTable
      state={game.state}
      localPlayerId={game.playerId}
      roomCode={game.room.roomCode}
      spectatorCount={game.room.spectators ?? 0}
      connection={game.connection}
      events={game.lastEvents}
      onAction={(action) => {
        game.action(action);
      }}
      onLeave={() => {
        game.leave();
        router.push("/");
      }}
      onPlayAgain={game.rematch}
      onLobby={() => {
        game.leave();
        router.push("/");
      }}
    />
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="tabletop flex h-dvh flex-col items-center justify-center gap-4 font-display text-2xl text-[#dcc48a]">
      <span className="h-10 w-10 animate-spin rounded-full border-2 border-[#dcc48a]/25 border-t-[#dcc48a]" />
      {label}
    </div>
  );
}

function CantSit({
  roomCode,
  message,
  canWatch = false,
}: {
  roomCode: string;
  message: string;
  /** The table exists, so offer to spectate instead. */
  canWatch?: boolean;
}) {
  const router = useRouter();
  return (
    <div className="tabletop flex min-h-dvh items-center justify-center px-4">
      <div className="parchment w-full max-w-md rounded-2xl px-7 py-8 text-center">
        <p className="zone-label">TABLE {roomCode.toUpperCase()}</p>
        <h1 className="mt-2 font-display text-3xl text-ink">Can&apos;t take a seat</h1>
        <p className="mt-3 text-ink/70">{message}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {canWatch && (
            <Button onClick={() => router.push(`/game/${roomCode.toUpperCase()}?watch=1`)}>
              Watch the Game
            </Button>
          )}
          <Button variant={canWatch ? "ivory" : "gold"} onClick={() => router.push("/")}>
            Back to Home
          </Button>
          {!canWatch && (
            <Button variant="ivory" onClick={() => router.push("/lobby?mode=create")}>
              Create a Table
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Who is already at the table, and how many seats remain. */
function SeatedPreview({ room }: { room: RoomPreview }) {
  const open = Math.max(0, room.maxPlayers - room.players.length);
  return (
    <div className="mt-6 rounded-xl border border-ink/10 bg-white/45 px-3 py-2.5">
      <p className="zone-label">
        AT THE TABLE · {room.players.length} / {room.maxPlayers}
        {!room.seated && (
          <span className="text-[#1f7a41]">
            {" "}
            · {open} seat{open === 1 ? "" : "s"} open
          </span>
        )}
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {room.players.map((player) => (
          <li
            key={player.id}
            className="flex items-center gap-1.5 rounded-full bg-white/70 py-0.5 pr-2.5 pl-0.5 text-sm text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
          >
            <PlayerAvatar id={player.avatar} size={22} />
            {player.name}
            {player.id === room.hostPlayerId && (
              <span className="text-[0.55rem] font-bold tracking-[0.14em] text-gold">HOST</span>
            )}
          </li>
        ))}
      </ul>
      <Link
        href={`/game/${room.roomCode}?watch=1`}
        className="mt-2 inline-block text-xs text-ink/60 underline-offset-2 hover:text-[#8a6420] hover:underline"
      >
        Or just watch without taking a seat →
      </Link>
    </div>
  );
}
