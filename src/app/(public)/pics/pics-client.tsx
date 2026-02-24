"use client";

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useRef } from "react";

const placeholderImages = [
  { id: 1, color: "from-pink-500/40 to-orange/40", label: "Sunset Ceremony" },
  { id: 2, color: "from-amber/40 to-golden/40", label: "Art Installation" },
  { id: 3, color: "from-coral/40 to-pink-500/40", label: "Night Lights" },
  { id: 4, color: "from-orange/40 to-amber/40", label: "Desert Dawn" },
  { id: 5, color: "from-pink-500/40 to-coral/40", label: "The Build" },
  { id: 6, color: "from-golden/40 to-orange/40", label: "Community" },
  { id: 7, color: "from-amber/40 to-pink-500/40", label: "Sound Camp" },
  { id: 8, color: "from-coral/40 to-golden/40", label: "Golden Hour" },
  { id: 9, color: "from-pink-500/40 to-amber/40", label: "Playa Magic" },
];

function TiltCard({
  color,
  label,
  index,
}: {
  color: string;
  label: string;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [8, -8]), {
    stiffness: 300,
    damping: 30,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), {
    stiffness: 300,
    damping: 30,
  });

  function handleMouseMove(e: React.MouseEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  return (
    <motion.div
      ref={ref}
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl"
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
    >
      {/* Gradient placeholder */}
      <div className={`absolute inset-0 bg-gradient-to-br ${color}`} />
      <div className="absolute inset-0 bg-blue-950/30" />

      {/* Shimmer overlay */}
      <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />

      {/* Label */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-blue-950/80 to-transparent p-4 pt-12">
        <p className="text-sm font-medium text-sand-200">{label}</p>
      </div>
    </motion.div>
  );
}

export default function PicsClient() {
  return (
    <main className="min-h-screen px-6 py-24">
      {/* Header */}
      <section className="mx-auto max-w-3xl text-center">
        <motion.h1
          className="text-5xl font-bold text-gradient-warm sm:text-6xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Pics
        </motion.h1>
        <motion.p
          className="mt-6 text-lg text-sand-300"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Moments from the playa, preserved in pixels.
        </motion.p>
      </section>

      {/* Image Grid */}
      <section className="mx-auto mt-16 max-w-6xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {placeholderImages.map((img, i) => (
            <TiltCard
              key={img.id}
              color={img.color}
              label={img.label}
              index={i}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
