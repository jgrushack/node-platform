"use client";

import { motion } from "framer-motion";

const timeline = [
  {
    year: "2019",
    title: "The Campfire",
    description:
      "15 people, a patch of desert, and a shared idea. NODE started as Node Republik — a group of friends who wanted to build something intentional.",
  },
  {
    year: "2020",
    title: "The Pause",
    description:
      "No playa. We kept the thread alive with calls, shared playlists, and plans for what came next.",
  },
  {
    year: "2021",
    title: "First Real Build",
    description:
      "30 members. Proper infrastructure for the first time. A sound system that actually worked.",
  },
  {
    year: "2022",
    title: "The Identity",
    description:
      "Interactive LED sculptures and our first art that stopped people in their tracks. We started figuring out who we were.",
  },
  {
    year: "2023",
    title: "Structure",
    description:
      "We formalized. Point systems for accountability. Pod leads. Monthly calls. The 10 Principles became part of every conversation, not just an idea on a poster.",
  },
  {
    year: "2024",
    title: "Full Send",
    description:
      "Our biggest year. The camp ran like a machine and the parties ran late. We became the camp people came back to.",
  },
  {
    year: "2026",
    title: "What's Next",
    description:
      "~55 campers. Daily yoga. The Rocket Fuel Coffee Bar. More consistent interactivity, more art, and always more communal effort. This is where you come in.",
  },
];

export default function AboutClient() {
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
          About NODE
        </motion.h1>
        <motion.p
          className="mt-6 text-lg text-sand-300"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Named after the structure of a decentralized network — the point where an individual connects to something larger.
        </motion.p>
      </section>

      {/* Timeline */}
      <section className="relative mx-auto mt-24 max-w-3xl">
        {/* Glowing center line — hidden on mobile */}
        <div className="absolute left-4 top-0 h-full w-px bg-gradient-to-b from-pink-500/50 via-amber/30 to-transparent md:left-1/2 md:-translate-x-1/2" />

        <div className="space-y-12 md:space-y-16">
          {timeline.map((item, i) => {
            const isLeft = i % 2 === 0;
            return (
              <motion.div
                key={item.year}
                className={`relative flex items-start gap-8 pl-12 md:pl-0 ${
                  isLeft ? "md:flex-row" : "md:flex-row-reverse"
                }`}
                initial={{ opacity: 0, x: isLeft ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                {/* Card side */}
                <div className="w-full md:w-[calc(50%-2rem)]">
                  <div className="glass-card rounded-2xl p-6">
                    <span className="text-sm font-medium font-heading text-pink-400">
                      {item.year}
                    </span>
                    <h3 className="mt-1 text-xl font-bold text-sand-100">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm text-sand-300">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Center dot */}
                <div className="absolute left-2.5 top-4 flex items-center justify-center md:left-1/2 md:-translate-x-1/2">
                  <div className="h-4 w-4 rounded-full border-2 border-pink-500 bg-blue-950">
                    <div className="h-full w-full animate-pulse rounded-full bg-pink-500/50" />
                  </div>
                </div>

                {/* Empty space for the other side — hidden on mobile */}
                <div className="hidden w-[calc(50%-2rem)] md:block" />
              </motion.div>
            );
          })}
        </div>
      </section>

    </main>
  );
}
