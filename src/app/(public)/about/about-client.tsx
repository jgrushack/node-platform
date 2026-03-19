"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const timeline = [
  {
    year: "2018",
    title: "Launch",
    description:
      "We overpromised, built an insane wooden temple and launched NODE Republik with 92 campers.",
    image: "/images/camp/2018.webp",
  },
  {
    year: "2019",
    title: "Not Quite Dialed...Yet",
    description:
      "60 people, a patch of desert, and the concept that we're building an optimistic future home.",
    image: "/images/camp/2019.png",
  },
  {
    year: "2020–2021",
    title: "The Pause",
    description:
      "No playa. We kept the thread alive with calls, hangs, shared playlists, and plans for what came next.",
    image: "/images/camp/2020.jpg",
  },
  {
    year: "2022",
    title: "Finding Our Identity",
    description:
      "NODE returned to Black Rock City, with 50 souls and more ambition than ever.",
    image: "/images/camp/2022.png",
  },
  {
    year: "2023",
    title: "Dialing It In",
    description:
      "With 55 nodes, we launched Big Petes' Hip-Hop BBQ, which became an instant hit.",
    image: "/images/camp/2023.png",
  },
  {
    year: "2024",
    title: "Full Send",
    description:
      "Our best year yet, though the playa had bigger ideas. We iterated and the communal effort was stronger than ever.",
    image: "/images/camp/2024.png",
  },
  {
    year: "2025",
    title: "Can we burn yet?",
    description:
      "The weather in Black Rock City hit hard and kept coming. The wind and rain may have destroyed some infrastructure but it did not destroy our spirit.",
    image: "/images/camp/2025.png",
  },
  {
    year: "2026",
    title: "Axis Mundi",
    description:
      "60 campers. More interactivity, more art, and always more communal effort. This is where you come in.",
  },
];

export default function AboutClient() {
  return (
    <main className="min-h-screen overflow-x-hidden px-4 py-20 sm:px-6 sm:py-24">
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
      <section className="relative mx-auto mt-12 max-w-4xl md:mt-24">
        {/* Glowing center line — hidden on mobile */}
        <div className="absolute left-4 top-0 h-full w-px bg-gradient-to-b from-pink-500/50 via-amber/30 to-transparent md:left-1/2 md:-translate-x-1/2" />

        <div className="space-y-12 md:space-y-16">
          {timeline.map((item, i) => {
            const isLeft = i % 2 === 0;
            return (
              <motion.div
                key={item.year}
                className={`relative flex flex-col gap-4 pl-12 md:flex-row md:items-start md:gap-8 md:pl-0 ${isLeft ? "md:flex-row" : "md:flex-row-reverse"
                  }`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: 0.1 }}
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

                {/* Photo side — opposite of card */}
                <div className={`w-full md:w-[calc(50%-2rem)] ${isLeft ? "md:pl-6" : "md:pr-6"}`}>
                  {item.image ? (
                    <div className={`relative aspect-[4/3] max-w-[280px] overflow-hidden rounded-xl ${isLeft ? "" : "md:ml-auto"}`}>
                      <Image
                        src={item.image}
                        alt={`NODE ${item.year}`}
                        fill
                        className="object-cover"
                        sizes="280px"
                      />
                    </div>
                  ) : (
                    <div className="hidden md:block" />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

    </main>
  );
}
