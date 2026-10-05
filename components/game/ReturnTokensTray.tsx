"use client";

import { Button } from "@/components/ui/button";
import { GemIcon } from "@/components/gems/GemIcon";
import { RESOURCE_META, RESOURCE_TYPES } from "@/game-data/resources";
import { cn } from "@/lib/utils";
import type { ResourceType } from "@/game-engine/types";

interface ReturnTokensTrayProps {
  /** What the player would hold once the action's tokens are added. */
  held: Record<ResourceType, number>;
  /** How many tokens must go back to reach the hand limit. */
  required: number;
  discard: Partial<Record<ResourceType, number>>;
  onChangeDiscard: (type: ResourceType, value: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Hand-limit return step for actions other than taking gems (reserving with a Royal). */
export function ReturnTokensTray({
  held,
  required,
  discard,
  onChangeDiscard,
  onConfirm,
  onCancel,
}: ReturnTokensTrayProps) {
  const returning = RESOURCE_TYPES.reduce((sum, type) => sum + (discard[type] ?? 0), 0);
  const toReturn = Math.max(0, required - returning);

  return (
    <div className="action-rail flex flex-nowrap items-center gap-3 rounded-lg px-3 py-1.5">
      <div className="shrink-0">
        <p className={cn("zone-label", toReturn > 0 && "text-[#ff9a6b]")}>
          {toReturn > 0 ? `RETURN ${toReturn} MORE` : "RETURNING"}
        </p>
        <div className="mt-0.5 flex items-center gap-1">
          {RESOURCE_TYPES.map((type) => {
            const max = held[type];
            const value = discard[type] ?? 0;
            return (
              <div
                key={type}
                className={cn(
                  "flex items-center rounded-full border py-0.5 pr-0.5 pl-1",
                  value > 0 ? "border-[#ff9a6b]/50 bg-[#ff9a6b]/10" : "border-ink/15",
                  max === 0 && "opacity-35",
                )}
              >
                <button
                  type="button"
                  className="focus-ring flex items-center gap-0.5 disabled:cursor-not-allowed"
                  onClick={() => onChangeDiscard(type, Math.min(max, value + 1))}
                  aria-label={`Return one more ${RESOURCE_META[type].name}`}
                  disabled={value >= max || toReturn === 0}
                >
                  <GemIcon type={type} size={22} />
                  <span className="w-4 text-center font-sans text-sm font-bold">{value}</span>
                </button>
                <button
                  type="button"
                  className="focus-ring ml-0.5 h-4 w-4 rounded-full text-xs leading-none text-ink/60 hover:bg-ink/10 disabled:invisible"
                  onClick={() => onChangeDiscard(type, Math.max(0, value - 1))}
                  aria-label={`Return one less ${RESOURCE_META[type].name}`}
                  disabled={value === 0}
                >
                  −
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" onClick={onConfirm} disabled={toReturn > 0}>
          Confirm
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
