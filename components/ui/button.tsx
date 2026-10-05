"use client";

import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center rounded-sm px-5 py-2.5 font-medium tracking-[0.14em] uppercase transition-[color,background-color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:active:scale-100 disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      variant: {
        gold: "border border-[#8a6420] bg-gradient-to-b from-[#cdb98c] to-[#b58a32] font-semibold text-[#2a1a05] shadow-[0_2px_6px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.5)] hover:from-[#f0d17f] hover:to-[#c39537]",
        ivory: "btn-ivory border border-[#2a241c]/25 bg-surface font-semibold text-[#2a241c] shadow-[0_1px_3px_rgba(0,0,0,0.15)] hover:bg-[#f3ead8]",
        ghost: "border border-transparent text-ink/60 hover:text-ink",
      },
      size: {
        default: "text-[0.8rem]",
        sm: "px-3.5 py-2 text-[0.76rem]",
        lg: "px-8 py-3 text-sm",
      },
    },
    defaultVariants: {
      variant: "gold",
      size: "default",
    },
  },
);

// ComponentProps includes `ref`, which React 19 passes through as a normal prop.
type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
