"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const statements = [
  { text: "SHOW UP", color: "text-gradient-warm" },
  { text: "DO THE WORK", color: "text-gradient-pink" },
  { text: "SHARE WHAT YOU HAVE", color: "text-gradient-golden" },
  { text: "READ THE ROOM", color: "text-gradient-warm" },
  { text: "PULL THEM IN", color: "text-gradient-pink" },
  { text: "LEAVE NOTHING", color: "text-gradient-golden" },
  { text: "THIS IS NODE", color: "text-gradient-warm", hasBrand: true },
];

function KineticStatement({
  text,
  color,
  index,
  hasBrand,
}: {
  text: string;
  color: string;
  index: number;
  hasBrand?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const x = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [index % 2 === 0 ? -100 : 100, 0, index % 2 === 0 ? 100 : -100]
  );
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 0.8]);
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    [0, 1, 1, 0]
  );

  const brandStart = hasBrand ? text.indexOf("NODE") : -1;
  const brandEnd = brandStart >= 0 ? brandStart + 4 : -1;

  return (
    <motion.div
      ref={ref}
      className="flex min-h-[50vh] items-center justify-center overflow-hidden"
      style={{ opacity }}
    >
      <motion.h2
        className={`text-5xl font-bold tracking-tighter sm:text-7xl md:text-8xl lg:text-9xl ${color}`}
        style={{ x, scale }}
      >
        {text.split("").map((char, i) => (
          <motion.span
            key={i}
            className={i >= brandStart && i < brandEnd ? "font-brand" : undefined}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.4,
              delay: i * 0.03,
              ease: "easeOut",
            }}
          >
            {char}
          </motion.span>
        ))}
      </motion.h2>
    </motion.div>
  );
}

export default function VibesClient() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <motion.p
          className="text-sm font-medium uppercase tracking-[0.3em] text-pink-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          Feel the energy
        </motion.p>
        <motion.h1
          className="mt-4 text-6xl font-bold text-gradient-warm sm:text-7xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          VIBES
        </motion.h1>
      </section>

      {/* Kinetic Statements */}
      <div className="relative">
        {statements.map((statement, i) => (
          <KineticStatement
            key={statement.text}
            text={statement.text}
            color={statement.color}
            index={i}
            hasBrand={statement.hasBrand ?? false}
          />
        ))}
      </div>

      {/* Our Principles */}
      <section className="mx-auto mt-32 max-w-4xl px-6">
        <motion.h2
          className="mb-12 text-center text-sm font-medium uppercase tracking-[0.3em] text-pink-400"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Our Principles
        </motion.h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {[
            {
              title: "Radical Inclusion",
              desc: "If you see someone on the fringe, pull them into the dance circle. Everyone is welcome here.",
            },
            {
              title: "Communal Effort",
              desc: "Everyone contributes. Build week, kitchen shifts, coffee bar, strike. We rise by lifting others.",
            },
            {
              title: "Leave No Trace",
              desc: "We respect the land. What we bring in, we take out. Strike is a team effort — Saturday morning, no exceptions.",
            },
            {
              title: "Consent",
              desc: "Not just important — sacred. Zero-strike policy. This is non-negotiable.",
            },
          ].map((value, i) => (
            <motion.div
              key={value.title}
              className="glass-card rounded-2xl p-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <h3 className="text-lg font-bold text-sand-100">
                {value.title}
              </h3>
              <p className="mt-2 text-sm text-sand-300">{value.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Bottom breathing space */}
      <section className="flex min-h-[40vh] items-center justify-center px-6">
        <motion.p
          className="text-xl text-sand-400"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
        >
          See you on the playa.
        </motion.p>
      </section>
    </main>
  );
}
