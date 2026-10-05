import { stoneArtSrc } from "@/lib/art";
import { RESOURCE_META } from "@/game-data/resources";
import { cn } from "@/lib/utils";
import type { ResourceType } from "@/game-engine/types";

interface GemIconProps {
  type: ResourceType;
  size?: number;
  className?: string;
  title?: string;
}

export function GemIcon({ type, size = 24, className, title }: GemIconProps) {
  const meta = RESOURCE_META[type];
  const label = title ?? meta.accessibilityLabel;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={stoneArtSrc(type, size)}
      alt=""
      width={size * 2}
      height={size * 2}
      draggable={false}
      decoding="async"
      title={label}
      aria-label={label}
      role="img"
      className={cn("inline-block shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
