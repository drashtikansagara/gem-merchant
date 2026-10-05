import { cardArtSrc } from "@/lib/art";
import { cn } from "@/lib/utils";
import type { Card } from "@/game-engine/types";

interface CardArtProps {
  card: Pick<Card, "tier" | "artwork" | "bonus">;
  scene?: string;
  className?: string;
}

export function CardArt({ card, scene, className }: CardArtProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("card-art pointer-events-none absolute inset-0 z-0 block overflow-hidden", className)}
      style={{
        backgroundImage: `url(${cardArtSrc(card, scene)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    />
  );
}
