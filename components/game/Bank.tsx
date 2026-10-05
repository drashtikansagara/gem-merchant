"use client";

import { GemToken } from "@/components/gems/GemToken";
import { RESOURCE_TYPES } from "@/game-data/resources";
import type { GemType, ResourceType } from "@/game-engine/types";

interface BankProps {
  bank: Record<ResourceType, number>;
  selected: GemType[];
  interactive: boolean;
  onToggle: (gem: GemType) => void;
}

export function Bank({ bank, selected, interactive, onToggle }: BankProps) {
  const counts = selected.reduce<Partial<Record<GemType, number>>>((acc, gem) => {
    acc[gem] = (acc[gem] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bank" aria-label="Gem bank">
      {RESOURCE_TYPES.map((type, index) => {
        const gem = type === "ROYAL" ? null : type;
        const isSelected = gem ? (counts[gem] ?? 0) > 0 : false;
        const empty = bank[type] <= 0;
        return (
          <GemToken
            key={type}
            type={type}
            count={bank[type]}
            selected={isSelected}
            glintDelay={index * 0.7}
            disabled={empty}
            onClick={
              interactive && gem && !empty ? () => onToggle(gem) : undefined
            }
          />
        );
      })}
    </div>
  );
}
