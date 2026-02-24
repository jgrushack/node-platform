"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

interface KineticTextProps {
  text: string;
  className?: string;
  direction?: "left" | "right";
  letterDelay?: number;
}

export function KineticText({
  text,
  className = "",
  direction = "left",
  letterDelay = 0.03,
}: KineticTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const x = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    direction === "left" ? [-80, 0, 80] : [80, 0, -80]
  );
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.85, 1, 0.85]);
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    [0, 1, 1, 0]
  );

  return (
    <motion.div
      ref={ref}
      className="flex items-center justify-center overflow-hidden"
      style={{ opacity }}
    >
      <motion.span className={className} style={{ x, scale }}>
        {text.split("").map((char, i) => (
          <motion.span
            key={i}
            className="inline-block"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.35,
              delay: i * letterDelay,
              ease: "easeOut",
            }}
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        ))}
      </motion.span>
    </motion.div>
  );
}
