"use client";

import { motion } from "framer-motion";

const timeline = [
  {
    year: "2019",
    title: "The Spark",
    description:
      "A group of friends, a shared dream, and a patch of desert. NODE was born around a campfire with 15 souls.",
  },
  {
    year: "2020",
    title: "The Pause",
    description:
      "The world stopped, but we didn't. Virtual gatherings, shared playlists, and plans for what could be.",
  },
  {
    year: "2021",
    title: "Renegade Return",
    description:
      "We came back stronger. 30 members, our first proper infrastructure, and a sound system that shook the playa.",
  },
  {
    year: "2022",
    title: "Finding Our Voice",
    description:
      "Art installations that stopped people in their tracks. Interactive LED sculptures and our signature pink glow.",
  },
  {
    year: "2023",
    title: "The Growth",
    description:
      "60 members strong. Multiple theme camps merged under the NODE banner. Community, amplified.",
  },
  {
    year: "2024",
    title: "Full Bloom",
    description:
      "Our biggest year yet. 80+ members, award-winning art, legendary parties, and a family forged in dust.",
  },
  {
    year: "2026",
    title: "The Future",
    description:
      "This is where you come in. We're building something unprecedented. Join us.",
  },
];

export default function AboutPage() {
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
          Our Story
        </motion.h1>
        <motion.p
          className="mt-6 text-lg text-sand-300"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          From a spark in the desert to a collective that lights up the night.
        </motion.p>
      </section>

      {/* Timeline */}
      <section className="relative mx-auto mt-24 max-w-3xl">
        {/* Glowing center line */}
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-pink-500/50 via-amber/30 to-transparent" />

        <div className="space-y-16">
          {timeline.map((item, i) => {
            const isLeft = i % 2 === 0;
            return (
              <motion.div
                key={item.year}
                className={`relative flex items-start gap-8 ${
                  isLeft ? "flex-row" : "flex-row-reverse"
                }`}
                initial={{ opacity: 0, x: isLeft ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                {/* Card side */}
                <div className="w-[calc(50%-2rem)]">
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
                <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center justify-center">
                  <div className="h-4 w-4 rounded-full border-2 border-pink-500 bg-blue-950">
                    <div className="h-full w-full animate-pulse rounded-full bg-pink-500/50" />
                  </div>
                </div>

                {/* Empty space for the other side */}
                <div className="w-[calc(50%-2rem)]" />
              </motion.div>
            );
          })}
        </div>
      </section>

    </main>
  );
}
