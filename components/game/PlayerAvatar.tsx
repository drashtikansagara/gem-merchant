import { cn } from "@/lib/utils";

interface PlayerAvatarProps {
  id: string;
  size?: number;
  className?: string;
}

export function PlayerAvatar({ id, size = 36, className }: PlayerAvatarProps) {
  const index = Number.parseInt(id.replace(/\D/g, ""), 10) || 1;
  const hue = (index * 47) % 360;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={cn("rounded-full", className)}
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="19" fill="#f7f0e2" stroke="#b58a32" strokeWidth="1.5" />
      <polygon
        points="20,6 32,16 28,32 12,32 8,16"
        fill={`hsl(${hue} 35% 42%)`}
      />
      <circle cx="20" cy="18" r="4" fill="#efe6d6" opacity="0.85" />
    </svg>
  );
}
