"use client";

import { motion } from "framer-motion";

const timeline = [
  {
    year: "2017",
    title: "The Genesis",
    description:
      'A few colleagues sat around in the peak heat of the 2017 burn thinking, "What if we built our own camp?" The idea took root.',
  },
  {
    year: "2018",
    title: "Launch",
    description:
      "We overpromised, built an insane wooden temple and launched NODE Republik with 92 campers.",
  },
  {
    year: "2019",
    title: "Not Quite Dialed...Yet",
    description:
      "60 people, a patch of desert, and the concept that we're building an optimistic future home.",
  },
  {
    year: "2020–2021",
    title: "The Pause",
    description:
      "No playa. We kept the thread alive with calls, hangs, shared playlists, and plans for what came next.",
  },
  {
    year: "2022",
    title: "Finding Our Identity",
    description:
      "NODE returned to Black Rock City, with 50 souls and more ambition than ever.",
  },
  {
    year: "2023",
    title: "Dialing It In",
    description:
      "With 55 nodes, we launched Big Petes' Hip-Hop BBQ, which became an instant hit.",
  },
  {
    year: "2024",
    title: "Full Send",
    description:
      "Our best year yet, though the playa had bigger ideas. We iterated and the communal effort was stronger than ever.",
  },
  {
    year: "2026",
    title: "What's Next",
    description:
      "~60 campers. More interactivity, more art, and always more communal effort. This is where you come in.",
  },
];

export default function AboutClient() {
  return (
    <main className="min-h-screen px-6 py-24">
      {/* Header */}
      <section className="mx-auto max-w-3xl text-center">
        <motion.h1
          className="text-5xl font-bold text-gradient-warm sm:text-6xl md:text-7xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          History
        </motion.h1>
        <motion.p
          className="mt-6 flex flex-wrap items-baseline justify-center gap-2 text-sand-300 sm:gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <span className="text-xl font-bold text-sand-100 font-brand tracking-wide">NODE</span>
          <span className="text-sand-400">/</span>
          <span>noʊd</span>
          <span className="text-sand-400">/</span>
          <span className="text-sand-400 italic">noun</span>
          <span>a connection point in a network.</span>
        </motion.p>
      </section>

      {/* Timeline */}
      <section className="relative mx-auto mt-12 max-w-3xl md:mt-24">
        {/* Glowing center line — hidden on mobile */}
        <div className="absolute left-4 top-0 h-full w-px bg-gradient-to-b from-pink-500/50 via-amber/30 to-transparent md:left-1/2 md:-translate-x-1/2" />

        <div className="space-y-12 md:space-y-16">
          {timeline.map((item, i) => {
            const isLeft = i % 2 === 0;
            return (
              <motion.div
                key={item.year}
                className={`relative flex items-start gap-8 pl-12 md:pl-0 ${isLeft ? "md:flex-row" : "md:flex-row-reverse"
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
