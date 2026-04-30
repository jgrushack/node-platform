"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Bubbles live in the dead space outside the centered card column (max-w-5xl = 1024px).
// We position them with calc(50% - HALF_CARD - bubble_size - gap) so they always sit
// just outside the cards regardless of viewport width. Narrow viewports clip them
// automatically thanks to overflow-x-clip on <main>.
const HALF_CARD = 512;

type SplashPhoto = {
  src: string;
  top?: string;
  bottom?: string;
  side: "left" | "right";
  size: number;
  /** distance from horizontal center of the page to the inner edge of the bubble. defaults to HALF_CARD (cards' edge). smaller anchor = bubble pulled in toward center. */
  anchor?: number;
  /** extra px between the anchor and the bubble's inner edge */
  gap: number;
  duration: number;
  delay: number;
};

const splashPhotos: SplashPhoto[] = [
  { src: "/images/home/splash-1.png", top: "6%", side: "left", size: 130, gap: 40, duration: 10, delay: 0 },
  { src: "/images/home/splash-2.jpg", top: "14%", side: "right", size: 145, gap: 30, duration: 11, delay: 1.2 },
  // Second row — pulled inward (smaller anchor) so they sit nearer the hero text instead of in the outer margins.
  // Vertically positioned in the dead space below the subtitle / around the Apply button so they're not crowded against NODE 2026 or the cards.
  { src: "/images/home/splash-3.jpg", top: "46%", side: "left", size: 115, gap: 0, anchor: 320, duration: 9.5, delay: 0.6 },
  { src: "/images/home/splash-4.jpg", top: "37%", side: "right", size: 135, gap: 0, anchor: 340, duration: 12, delay: 2 },
  // splash-5 (DJ) shifted down so the left margin doesn't feel stacked with splash-7
  { src: "/images/home/splash-5.jpg", top: "76%", side: "left", size: 125, gap: 35, duration: 9, delay: 1.6 },
  { src: "/images/home/splash-6.jpg", top: "78%", side: "right", size: 140, gap: 60, duration: 11.5, delay: 0.4 },
  // splash-7 (BM fireworks) pulled inward toward center-bottom so it's not in the outer left margin under the DJ bubble
  { src: "/images/home/splash-7.jpeg", top: "90%", side: "left", size: 120, gap: 55, anchor: 50, duration: 12.5, delay: 2.4 },
  // Footer bubble — anchored to bottom of <main>. anchor: 180 places the bubble's right edge ~320px right of center
  // (in the right-side margin), giving the splash-7 bubble room in the lower-center area.
  // bottom: -90px nudges it down toward the © NODE 2026 footer text, leaving breathing room between it and the cards above.
  { src: "/images/home/scorp.jpg", bottom: "-90px", side: "right", size: 140, gap: 60, anchor: 180, duration: 11, delay: 1.8 },
];

// Mobile bubble cluster — small photos scattered around the NODE 2026 hero text on narrow viewports.
// Positioned with vh (vertical) and % (horizontal) so they always sit within the hero section regardless of phone size.
type MobileSplashPhoto = {
  src: string;
  top: string;
  left?: string;
  right?: string;
  size: number;
  duration: number;
  delay: number;
};

const mobileSplashPhotos: MobileSplashPhoto[] = [
  { src: "/images/home/splash-1.png", top: "6vh", left: "19%", size: 58, duration: 10, delay: 0 },
  { src: "/images/home/splash-2.jpg", top: "12vh", right: "8%", size: 64, duration: 11, delay: 1.2 },
  { src: "/images/home/splash-3.jpg", top: "32vh", left: "4%", size: 54, duration: 9.5, delay: 0.6 },
  { src: "/images/home/splash-4.jpg", top: "28vh", right: "5%", size: 60, duration: 12, delay: 2 },
  { src: "/images/home/splash-5.jpg", top: "62vh", left: "8%", size: 56, duration: 9, delay: 1.6 },
  { src: "/images/home/splash-6.jpg", top: "70vh", right: "6%", size: 60, duration: 11.5, delay: 0.4 },
  { src: "/images/home/splash-7.jpeg", top: "85vh", left: "38%", size: 52, duration: 12.5, delay: 2.4 },
];

export default function HomeClient() {
  return (
    <main className="relative z-10 min-h-screen overflow-x-clip">
      {/* Floating splash photos — decorative bubbles drifting around the page */}
      <div className="pointer-events-none absolute inset-0 z-0 hidden md:block" aria-hidden="true">
        {splashPhotos.map((photo, i) => {
          const anchor = photo.anchor ?? HALF_CARD;
          const offset = anchor + photo.size + photo.gap;
          return (
            <motion.div
              key={photo.src}
              className="absolute overflow-hidden rounded-full shadow-2xl"
              style={{
                top: photo.top,
                bottom: photo.bottom,
                left: photo.side === "left" ? `calc(50% - ${offset}px)` : undefined,
                right: photo.side === "right" ? `calc(50% - ${offset}px)` : undefined,
                width: photo.size,
                height: photo.size,
              }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{
                opacity: 0.9,
                scale: 1,
                y: [0, -16, 0, 14, 0],
                x: [0, 10, 0, -10, 0],
                rotate: [0, 1, 0, -1, 0],
              }}
              transition={{
                opacity: { duration: 1.2, delay: 0.3 + i * 0.15 },
                scale: { duration: 1.2, delay: 0.3 + i * 0.15 },
                y: { duration: photo.duration * 1.4, delay: photo.delay, repeat: Infinity, ease: "easeInOut" },
                x: { duration: photo.duration * 1.7, delay: photo.delay, repeat: Infinity, ease: "easeInOut" },
                rotate: { duration: photo.duration * 2, delay: photo.delay, repeat: Infinity, ease: "easeInOut" },
              }}
            >
              <Image
                src={photo.src}
                alt=""
                fill
                className="object-cover"
                sizes="145px"
              />
            </motion.div>
          );
        })}
      </div>

      {/* Mobile bubble cluster — small splash photos scattered around the hero text on narrow viewports. Hidden on md+. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-screen md:hidden" aria-hidden="true">
        {mobileSplashPhotos.map((photo, i) => (
          <motion.div
            key={photo.src}
            className="absolute overflow-hidden rounded-full shadow-xl"
            style={{
              top: photo.top,
              left: photo.left,
              right: photo.right,
              width: photo.size,
              height: photo.size,
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{
              opacity: 0.9,
              scale: 1,
              y: [0, -8, 0, 7, 0],
              x: [0, 5, 0, -5, 0],
              rotate: [0, 1, 0, -1, 0],
            }}
            transition={{
              opacity: { duration: 1, delay: 0.2 + i * 0.1 },
              scale: { duration: 1, delay: 0.2 + i * 0.1 },
              y: { duration: photo.duration * 1.4, delay: photo.delay, repeat: Infinity, ease: "easeInOut" },
              x: { duration: photo.duration * 1.7, delay: photo.delay, repeat: Infinity, ease: "easeInOut" },
              rotate: { duration: photo.duration * 2, delay: photo.delay, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            <Image
              src={photo.src}
              alt=""
              fill
              className="object-cover"
              sizes="64px"
            />
          </motion.div>
        ))}
      </div>

      {/* Hero Section */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        {/* Logo Mark with glow */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative mb-8"
        >
          <div className="absolute inset-0 blur-3xl">
            <div className="h-full w-full rounded-full bg-pink-500/30" />
          </div>
          <Image
            src="/node-mark.svg"
            alt="NODE"
            width={120}
            height={120}
            className="relative z-10"
            priority
          />
        </motion.div>

        {/* Title */}
        <motion.h1
          className="text-5xl font-bold tracking-tighter text-gradient-warm sm:text-7xl md:text-8xl lg:text-9xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <span className="font-brand">NODE 2026</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.div
          className="mt-6 flex max-w-md flex-col gap-1 text-lg text-sand-300 sm:text-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <p>A network of dreamers and explorers.</p>
          <p>Born in the desert. Built for the future.</p>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-10"
        >
          <Link href="/apply">
            <Button
              size="lg"
              className="rounded-full bg-pink-500 px-8 text-lg font-semibold text-white hover:bg-pink-600 glow-pink justify-center"
            >
              Apply to NODE
            </Button>
          </Link>
        </motion.div>

      </section>

      {/* Info Cards */}
      <section className="relative z-10 px-4 pb-24 sm:px-6 sm:pb-32">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            {
              title: "Create",
              desc: "Installations, music curation, fashion, whatever you're into. Express it at NODE.",
              gradient: "from-pink-500/20 to-orange/20",
              image: "/images/home/create.jpg",
            },
            {
              title: "Connect",
              desc: "Strangers become soulmates. Friends become family. A year-round community.",
              gradient: "from-amber/20 to-golden/20",
              image: "/images/home/connect.jpg",
            },
            {
              title: "Contribute",
              desc: "Everyone has a role. Everyone has responsibility. We rise by lifting others.",
              gradient: "from-coral/20 to-pink-500/20",
              image: "/images/home/contribute.png",
            },
          ].map((card, i) => (
            <motion.div
              key={card.title}
              className={`glass-card rounded-2xl bg-gradient-to-br ${card.gradient} p-8`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              <div className="mx-auto mb-6 flex justify-center">
                <div className="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-2xl ring-1 ring-white/10">
                  <Image
                    src={card.image}
                    alt={card.title}
                    fill
                    className="object-cover"
                    sizes="200px"
                  />
                </div>
              </div>
              <h3 className="mb-3 text-2xl font-bold text-sand-100">
                {card.title}
              </h3>
              <p className="text-sand-300">{card.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </main>
  );
}
