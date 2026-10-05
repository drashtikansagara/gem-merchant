import { GAME_RULES } from "@/game-engine/rules/constants";
import { cn } from "@/lib/utils";

/** Thin gold bar showing progress toward the winning score. */
export function ScoreTrack({ points, className }: { points: number; className?: string }) {
  const percent = Math.min(100, (points / GAME_RULES.victoryPoints) * 100);
  return (
    <div
      className={cn("score-track", className)}
      role="progressbar"
      aria-label="Prestige toward victory"
      aria-valuemin={0}
      aria-valuemax={GAME_RULES.victoryPoints}
      aria-valuenow={points}
    >
      <div className="score-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}
