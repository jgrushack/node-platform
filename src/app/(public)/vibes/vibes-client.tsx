"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";

const statements: Array<{ text: string; color: string; hasBrand?: boolean }> = [
  { text: "RADICAL INCLUSION", color: "text-gradient-warm" },
  { text: "GIFTING", color: "text-gradient-pink" },
  { text: "DECOMMODIFICATION", color: "text-gradient-golden" },
  { text: "RADICAL SELF RELIANCE", color: "text-gradient-warm" },
  { text: "RADICAL SELF EXPRESSION", color: "text-gradient-pink" },
  { text: "COMMUNAL EFFORT", color: "text-gradient-golden" },
  { text: "CIVIC RESPONSIBILITY", color: "text-gradient-warm" },
  { text: "LEAVING NO TRACE", color: "text-gradient-pink" },
  { text: "PARTICIPATION", color: "text-gradient-golden" },
  { text: "IMMEDIACY", color: "text-gradient-warm" },
];

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

function KineticStatement({
  text,
  color,
  index,
  hasBrand,
  isMobile,
}: {
  text: string;
  color: string;
  index: number;
  hasBrand?: boolean;
  isMobile: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const range = isMobile ? 15 : 80;
  const x = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [index % 2 === 0 ? -range : range, 0, index % 2 === 0 ? range : -range]
  );
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.85, 1, 0.85]);
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
      className="flex min-h-[25vh] items-center justify-center overflow-hidden px-4"
      style={{ opacity }}
    >
      <motion.h2
        className={`text-center text-[clamp(1.25rem,5vw,2rem)] font-bold tracking-tighter sm:text-4xl md:text-6xl lg:text-8xl ${color}`}
        style={{ x, scale }}
      >
        {text.split("").map((char, i) => (
          <motion.span
            key={i}
            className={i >= brandStart && i < brandEnd ? "font-brand" : undefined}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.3,
              delay: isMobile ? Math.min(i * 0.015, 0.3) : i * 0.03,
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
  const isMobile = useIsMobile();

  return (
    <main className="min-h-screen overflow-hidden">
      {/* Header */}
      <section className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center sm:min-h-[60vh]">
        <motion.p
          className="text-sm font-medium uppercase tracking-[0.3em] text-pink-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          Feel the energy
        </motion.p>
        <motion.h1
          className="mt-4 text-5xl font-bold text-gradient-warm sm:text-6xl md:text-7xl"
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
            isMobile={isMobile}
          />
        ))}
      </div>

      {/* Our Principles */}
      <section className="mx-auto mt-16 max-w-4xl px-6 md:mt-32">
        <motion.h2
          className="mb-12 text-center text-sm font-medium uppercase tracking-[0.3em] text-pink-400"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Our Values
        </motion.h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {[
            {
              title: "Fail Fast",
              desc: "BM is about trying new things, take that risk. Fail or succeed, what matters is you learn and you are also aware of when it's time to reset.",
            },
            {
              title: "Evolve or Repeat (Somewhere Else)",
              desc: "We take risks but we learn, evolve and make the next opportunity better than the first. We do not continue to make the same mistakes at NODE because we believe in supporting each other's growth.",
            },
            {
              title: "Responsibility",
              desc: "You have a civic responsibility as a resident of BRC. That carries to NODE even more so. We take care of each other. We clean up after ourselves. We accept responsibility and acknowledge mistakes. We continue to build a better home than we started with.",
            },
            {
              title: "Live Free",
              desc: "Don't avoid / delay conflict. Make the effort to resolve situations before they have a chance to fester. Take your quandaries to the temple and release that energy. Keep your mind free of conflict and your burn will be much lighter.",
            },
            {
              title: "Consent",
              desc: "Not just important — sacred. Zero-strike policy. Anyone who violates this will be asked to leave NODE immediately. This is non-negotiable.",
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

      {/* Closing Statement */}
      <section className="mx-auto mt-16 max-w-3xl px-6 md:mt-32">
        <motion.p
          className="text-base leading-relaxed text-sand-300 sm:text-lg"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          Node is a future home, a brighter space where we envision a world that&apos;s not a dystopian nightmare. If love is our religion. Building is our church. In the act of coming together to raise Node, each of us (Nodes) is at the core of our practice. We believe that building together is the ultimate communion. Here we learn about each other and we learn about ourselves. In the challenge of &quot;figuring it out,&quot; we grow as leaders, friends, lovers, and humans. We meet each other on the playing field. The game starts and ends with working together. If we can build an optimistic future home on the playa - we can build anything in the real world. This is where masters from around the world - who are already building the technologies of the future come to play with the ultimate technology. Love.
        </motion.p>
      </section>

      {/* Bottom breathing space */}
      <section className="flex min-h-[30vh] items-center justify-center px-6">
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
