"use client";

import { Button } from "@/components/ui/button";
import { GemIcon } from "@/components/gems/GemIcon";
import { RESOURCE_META, RESOURCE_TYPES } from "@/game-data/resources";
import { GAME_RULES } from "@/game-engine/rules/constants";
import { cn } from "@/lib/utils";
import type { GemType, ResourceType } from "@/game-engine/types";
import { GEM_TYPES } from "@/game-engine/types";

interface TakeGemsTrayProps {
  selected: GemType[];
  mustDiscard: boolean;
  discard: Partial<Record<ResourceType, number>>;
  available: Record<ResourceType, number>;
  /** How many different gems a normal take must have (3, or fewer if the bank is short). */
  requiredDifferent: number;
  onChangeDiscard: (type: ResourceType, value: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TakeGemsTray({
  selected,
  mustDiscard,
  discard,
  available,
  requiredDifferent,
  onChangeDiscard,
  onConfirm,
  onCancel,
}: TakeGemsTrayProps) {
  const held = RESOURCE_TYPES.reduce((sum, type) => sum + available[type], 0);
  const returning = GEM_TYPES.reduce((sum, gem) => sum + (discard[gem] ?? 0), 0);
  const toReturn = Math.max(0, held + selected.length - GAME_RULES.maxTokensInHand - returning);
  const isDouble = selected.length === 2 && selected[0] === selected[1];
  const complete = isDouble || selected.length === requiredDifferent;
  const hint = isDouble
    ? "Two of a kind"
    : `${selected.length} / ${requiredDifferent} different`;

  return (
    <div className="action-rail flex flex-nowrap items-center gap-3 rounded-lg px-3 py-1.5">
      <div className="shrink-0">
        <p className="zone-label">
          TAKING <span className={cn(complete ? "text-[#6ee7a0]" : "text-ink/50")}>· {hint}</span>
        </p>
        <div className="mt-0.5 flex min-h-8 items-center gap-1.5">
          {selected.length === 0 ? (
            <span className="text-base whitespace-nowrap text-ink/70">Pick gems from the bank</span>
          ) : (
            selected.map((gem, index) => (
              <GemIcon key={`${gem}-${index}`} type={gem} size={30} />
            ))
          )}
        </div>
      </div>
      {mustDiscard && (
        <div className="shrink-0 border-l border-ink/15 pl-3">
          <p className={cn("zone-label", toReturn > 0 && "text-[#ff9a6b]")}>
            {toReturn > 0 ? `RETURN ${toReturn} MORE` : "RETURNING"}
          </p>
          <div className="mt-0.5 flex items-center gap-1">
            {GEM_TYPES.map((gem) => {
              const max = available[gem] + selected.filter((item) => item === gem).length;
              const value = discard[gem] ?? 0;
              return (
                <div
                  key={gem}
                  className={cn(
                    "flex items-center rounded-full border py-0.5 pr-0.5 pl-1",
                    value > 0 ? "border-[#ff9a6b]/50 bg-[#ff9a6b]/10" : "border-ink/15",
                    max === 0 && "opacity-35",
                  )}
                >
                  <button
                    type="button"
                    className="focus-ring flex items-center gap-0.5 disabled:cursor-not-allowed"
                    onClick={() => onChangeDiscard(gem, Math.min(max, value + 1))}
                    aria-label={`Return one more ${RESOURCE_META[gem].name}`}
                    disabled={value >= max || toReturn === 0}
                  >
                    <GemIcon type={gem} size={22} />
                    <span className="w-4 text-center font-sans text-sm font-bold">{value}</span>
                  </button>
                  <button
                    type="button"
                    className="focus-ring ml-0.5 h-4 w-4 rounded-full text-xs leading-none text-ink/60 hover:bg-ink/10 disabled:invisible"
                    onClick={() => onChangeDiscard(gem, Math.max(0, value - 1))}
                    aria-label={`Return one less ${RESOURCE_META[gem].name}`}
                    disabled={value === 0}
                  >
                    −
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex shrink-0 gap-1">
        <Button
          size="sm"
          onClick={onConfirm}
          disabled={!complete || (mustDiscard && toReturn > 0)}
          title={complete ? undefined : `Pick ${requiredDifferent} different gems, or click one twice for two of a kind`}
        >
          Confirm
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
