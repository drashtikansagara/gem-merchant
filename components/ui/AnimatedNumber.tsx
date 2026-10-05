"use client";

import { motion } from "framer-motion";
import { useState } from "react";

interface AnimatedNumberProps {
  value: number;
  className?: string;
}

/**
 * A number that pops and glows when it changes, so players notice what moved
 * (a score going up, a pile being taken from). No motion on first render.
 */
export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  // The value on the table when this appeared: showing it again needs no pop.
  const [mounted] = useState(value);
  const initial = value === mounted ? false : { scale: 1.7, filter: "brightness(1.8)" };

  return (
    <motion.span
      key={value}
      className={`count-pop ${className ?? ""}`}
      initial={initial}
      animate={{ scale: 1, filter: "brightness(1)" }}
      transition={{ type: "spring", stiffness: 420, damping: 16 }}
    >
      {value}
    </motion.span>
  );
}
