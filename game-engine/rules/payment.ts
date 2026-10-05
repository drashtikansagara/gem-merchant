import { GEM_TYPES, RESOURCE_TYPES, type GemType, type ResourceType } from "../types";
import { paymentTotal, remainingCost, remainingCostTotal } from "../helpers";

type PayingPlayer = {
  tokens: Record<ResourceType, number>;
  cards: { bonus: GemType }[];
};

export function suggestedPayment(
  player: PayingPlayer,
  cost: Partial<Record<GemType, number>>,
): Partial<Record<ResourceType, number>> | null {
  const remaining = remainingCost(player, cost);
  const payment: Partial<Record<ResourceType, number>> = {};
  let royalNeeded = 0;

  for (const gem of GEM_TYPES) {
    const need = remaining[gem];
    if (need <= 0) {
      continue;
    }
    const have = player.tokens[gem];
    const fromColor = Math.min(need, have);
    if (fromColor > 0) {
      payment[gem] = fromColor;
    }
    royalNeeded += need - fromColor;
  }

  if (royalNeeded > player.tokens.ROYAL) {
    return null;
  }
  if (royalNeeded > 0) {
    payment.ROYAL = royalNeeded;
  }
  return payment;
}

export function canAfford(
  player: PayingPlayer,
  cost: Partial<Record<GemType, number>>,
): boolean {
  return suggestedPayment(player, cost) !== null;
}

export function missingGemsMessage(
  player: PayingPlayer,
  cost: Partial<Record<GemType, number>>,
): string {
  const remaining = remainingCost(player, cost);
  const shortfalls: Array<{ gem: GemType; need: number }> = [];
  let royalPool = player.tokens.ROYAL;

  for (const gem of GEM_TYPES) {
    const need = remaining[gem];
    const have = player.tokens[gem];
    if (have >= need) {
      continue;
    }
    let missing = need - have;
    const useRoyal = Math.min(missing, royalPool);
    royalPool -= useRoyal;
    missing -= useRoyal;
    if (missing > 0) {
      shortfalls.push({ gem, need: missing });
    }
  }

  if (shortfalls.length === 0) {
    return "You cannot buy this card yet.";
  }
  if (shortfalls.length === 1) {
    const labels: Record<GemType, string> = {
      RUBY: "Ruby",
      SAPPHIRE: "Sapphire",
      EMERALD: "Emerald",
      ONYX: "Onyx",
      PEARL: "Pearl",
    };
    const item = shortfalls[0];
    return `You need ${item.need} more ${labels[item.gem]}.`;
  }
  return "You need more gems to buy this card.";
}

export function validatePayment(
  player: PayingPlayer,
  cost: Partial<Record<GemType, number>>,
  payment: Partial<Record<ResourceType, number>>,
): string | null {
  if (!isTokenCounts(payment)) {
    return "Payment is not valid for this card.";
  }
  const remaining = remainingCost(player, cost);
  const needTotal = remainingCostTotal(remaining);
  const payTotal = paymentTotal(payment);

  if (payTotal !== needTotal) {
    return "Payment must match the remaining cost.";
  }

  for (const gem of GEM_TYPES) {
    const paid = payment[gem] ?? 0;
    if (paid < 0 || paid > remaining[gem]) {
      return "Payment is not valid for this card.";
    }
    if (paid > player.tokens[gem]) {
      return "You do not have those gems.";
    }
  }

  const royal = payment.ROYAL ?? 0;
  if (royal < 0 || royal > player.tokens.ROYAL) {
    return "You do not have those gems.";
  }

  const coloredPaid = GEM_TYPES.reduce((sum, gem) => sum + (payment[gem] ?? 0), 0);
  if (coloredPaid + royal !== needTotal) {
    return "Payment must match the remaining cost.";
  }

  const colorGap = GEM_TYPES.reduce(
    (sum, gem) => sum + (remaining[gem] - (payment[gem] ?? 0)),
    0,
  );
  if (colorGap !== royal) {
    return "Gold must fill the remaining cost.";
  }

  return null;
}

/** Only known token types, in whole non-negative amounts. */
export function isTokenCounts(counts: Partial<Record<string, number>>): boolean {
  return Object.entries(counts).every(
    ([type, amount]) =>
      (RESOURCE_TYPES as readonly string[]).includes(type) &&
      Number.isInteger(amount) &&
      (amount ?? 0) >= 0,
  );
}
