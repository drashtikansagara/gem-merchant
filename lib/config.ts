import { GAME_RULES } from "@/game-engine/rules/constants";

export const GAME_CONFIG = {
  name: "Gem Merchant",
  tagline: "Build your fortune. Master the market.",
} as const;

export { GAME_RULES };

export const SESSION_COOKIE = "gm_session";
