"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const timeline = [
  {
    year: "2018",
    title: "Launch",
    description:
      "We overpromised, built an insane wooden temple and launched NODE Republik with 92 campers. A blueprint slowly emerged for our optimistic future home. Leaders were forged, 2x4s were splintered, and meaningful connections were formed beneath the shade of a geodome. Maximum experimentation, minimal inhibitions.",
    image: "/images/camp/2018.webp",
  },
  {
    year: "2019",
    title: "Not Quite Dialed...Yet",
    description:
      "60 people, a patch of desert, and the concept that we're building an optimistic future home. The training wheels came off as we gained familiarity with our infrastructure, camp systems, and group ethos. One step closer to bringing our future home into the present.",
    image: "/images/camp/2019.png",
  },
  {
    year: "2020–2021",
    title: "The Pause",
    description:
      "As the world sheltered in place, Node sadly had to raincheck BRC for two long years. We kept the spirit alive with camp calls, local hangs, shared playlists, and plans for what came next. They say you don't know the worth of water until the well runs dry, and this hiatus made us realize how special our yearly time in the desert can be.",
    image: "/images/camp/2020.jpg",
  },
  {
    year: "2022",
    title: "Finding Our Identity",
    description:
      "NODE returned to Black Rock City with 50 souls and more ambition than ever. The revamped camp flourished with fresh faces and new stretch tents. Gale force winds tried to batter our spirit, but we fought back with wide smiles and 18” lag bolts. Node's world-famous morning coffee & yoga made it's debut, keeping BRC citizens caffeinated and limber throughout the long desert days.",
    image: "/images/camp/2022.png",
  },
  {
    year: "2023",
    title: "Dialing It In",
    description:
      "With 55 nodes, we hit escape velocity. 2023 saw the inaugural Big Petes' Hip-Hop BBQ, which became an instant hit serving hundreds of burgers & dogs. We adopted the Tikivision art car for the week and took to the streets. While many burners only remember the mud and the rain, Node looks back fondly on the chaos as another challenge that needed to be overcome.",
    image: "/images/camp/2023.png",
  },
  {
    year: "2024",
    title: "Full Send",
    description:
      "Years of camp evolution, combined with Mother Nature finally letting up, allowed Node to thrive and have our best year yet on-playa. Build & strike were smooth as silk, the Hip Hop BBQ became the talk of town, one pair of Nodes got hitched and another popped the question, and we popped rosé under the hot Nevada sun.",
    image: "/images/camp/2024.png",
  },
  {
    year: "2025",
    title: "Can we burn yet?",
    description:
      "The weather in Black Rock City hit hard and kept coming. The wind and rain may have destroyed some infrastructure but it did not destroy our spirit. Newbie Nodes stepped up, resilience was our most valuable resource, and a long uphill battle eventually resulted in a beautiful view from the summit. We pulled it off, but the storm already had us thinking of how to do it bigger and better the next year…",
    image: "/images/camp/2025.png",
  },
  {
    year: "2026",
    title: "Axis Mundi",
    description:
      "Next year was always better. 60 campers. More interactivity, more art, and always more communal effort. This is where you come in! We can't wait for Node to have its best year yet, and we know you can help make it happen. Hit up the application form to join in on the fun.",
    image: "/images/camp/axis-mundi-2026.png",
    contain: true,
  },
];

// Decorative margin photos — sit in the dead space outside the centered timeline (max-w-4xl = 896px),
// progressing chronologically top → bottom and roughly aligned with the year entries.
const HALF_TIMELINE = 448;

const marginPhotos = [
  // Earliest — rocket build, near 2018 entry. Smaller + perfectly centered in the left margin.
  { src: "/images/about/about-1.png", top: "6%", side: "left" as const, size: 180, gap: 0, duration: 11, delay: 0 },
  { src: "/images/about/about-2.png", top: "32%", side: "right" as const, size: 220, gap: 10, duration: 12, delay: 1.4 },
  { src: "/images/about/about-3.png", top: "58%", side: "left" as const, size: 220, gap: 10, duration: 10, delay: 0.8 },
  // about-4 (the wide "party on another planet" banner) lives in its own centered section below the timeline — see <section> below.
];

export default function AboutClient() {
  return (
    <main className="relative z-10 min-h-screen overflow-x-clip px-4 pt-20 pb-8 sm:px-6 sm:pt-24 sm:pb-10">
      {/* Decorative margin photos — chronological top → bottom in the side margins. Static and uncropped. */}
      {/* Centered horizontally in their respective margins: 25% is the midpoint of the left margin (and 25% from the right edge is the right margin's midpoint), so subtracting half the bubble width + half the timeline width puts the bubble's edge at the margin midpoint minus half its size — i.e. dead-center in the margin regardless of viewport. The optional `gap` field nudges the bubble toward the timeline (positive) or the viewport edge (negative). */}
      <div className="pointer-events-none absolute inset-0 z-0 hidden md:block" aria-hidden="true">
        {marginPhotos.map((photo) => {
          const offset = (HALF_TIMELINE + photo.size) / 2 - photo.gap;
          return (
            <div
              key={photo.src}
              className="absolute"
              style={{
                top: photo.top,
                left: photo.side === "left" ? `calc(25% - ${offset}px)` : undefined,
                right: photo.side === "right" ? `calc(25% - ${offset}px)` : undefined,
                width: photo.size,
              }}
            >
              <Image
                src={photo.src}
                alt=""
                width={1086}
                height={1448}
                className="h-auto w-full"
                sizes="160px"
                unoptimized
              />
            </div>
          );
        })}
      </div>

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
                    <div className={`relative ${item.contain ? "aspect-square" : "aspect-[4/3]"} max-w-[280px] overflow-hidden rounded-xl ${isLeft ? "" : "md:ml-auto"}`}>
                      <Image
                        src={item.image}
                        alt={`NODE ${item.year}`}
                        fill
                        className={item.contain ? "object-contain" : "object-cover"}
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

      {/* Wide "party on another planet" banner — centered between the 2026 entry and the © NODE footer. ~62% page width on desktop, full width on mobile (capped at 960px so it doesn't get oversized on huge screens). */}
      <section className="mx-auto mt-6 w-full max-w-[960px] px-6 md:mt-10 md:w-[62.5%]" aria-hidden="true">
        <Image
          src="/images/about/about-4-wide.png"
          alt=""
          width={1916}
          height={821}
          className="h-auto w-full"
          sizes="(min-width: 768px) 62vw, 90vw"
          unoptimized
        />
      </section>

    </main>
  );
}
