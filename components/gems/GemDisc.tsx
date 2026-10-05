import { RESOURCE_META } from "@/game-data/resources";
import { cn } from "@/lib/utils";
import type { ResourceType } from "@/game-engine/types";

interface GemDiscProps {
  type: ResourceType;
  count?: number;
  /** Pixels, or any CSS length (e.g. a calc() tied to the card size). */
  size?: number | string;
  /** Square chip, used for noble requirements (they ask for cards, not gems). */
  square?: boolean;
  className?: string;
  title?: string;
  /** Numeral size as a share of the disc. */
  fontScale?: number;
}

export function GemDisc({
  type,
  count,
  size = 16,
  square = false,
  className,
  title,
  fontScale = 0.72,
}: GemDiscProps) {
  const meta = RESOURCE_META[type];
  const fill = type === "PEARL" ? "#f4efe4" : meta.iconColor;
  const light = type === "PEARL";
  const length = typeof size === "number" ? `${size}px` : size;
  const ring = typeof size === "number" ? Math.max(1.5, size * 0.09) : 2;

  return (
    <span
      className={cn(
        "gem-disc inline-flex shrink-0 items-center justify-center font-sans leading-none font-bold tabular-nums",
        square ? "rounded-[3px]" : "rounded-full",
        light ? "gem-disc-light" : "gem-disc-dark",
        className,
      )}
      style={{
        width: length,
        height: length,
        background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.45), transparent 55%), ${fill}`,
        fontSize: `max(10px, calc(${length} * ${fontScale}))`,
        boxShadow: `0 0 0 ${ring}px #fffdf8, 0 1px 3px ${ring}px rgba(0,0,0,0.35), inset 0 -2px 3px rgba(0,0,0,0.25)${type === "PEARL" ? ", inset 0 0 0 1px rgba(60,50,40,0.55)" : ""}`,
      }}
      title={title ?? (count != null ? `${count} ${meta.name}` : meta.name)}
    >
      {count}
    </span>
  );
}
