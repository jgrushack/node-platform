"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const manifesto = [
  "We show up and we do the work.",
  "We share what we have.",
  "We leave the desert better than we found it.",
  "We pull strangers into the dance circle.",
  "This is NODE.",
];

export default function HomeClient() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Hero Section */}
      <section className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
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
          className="text-7xl font-bold tracking-tighter text-gradient-warm sm:text-8xl md:text-9xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <span className="font-brand">NODE 2026</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.div
          className="mt-6 flex max-w-md flex-col gap-1 text-xl text-sand-300"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <p>Art, music, and communal effort on the playa.</p>
          <p>The point where you connect to something larger.</p>
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
              className="group rounded-full bg-pink-500 px-8 text-lg font-semibold text-white hover:bg-pink-600 glow-pink"
            >
              Apply to NODE
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-12 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="h-8 w-5 rounded-full border-2 border-sand-400/30 p-1">
            <div className="mx-auto h-2 w-1.5 rounded-full bg-sand-400/50" />
          </div>
        </motion.div>
      </section>

      {/* Manifesto Section */}
      <section className="px-6 py-32">
        <div className="mx-auto max-w-3xl">
          <motion.h2
            className="mb-16 text-center text-sm font-medium uppercase tracking-[0.3em] text-pink-400"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            How We Camp
          </motion.h2>
          <div className="space-y-8">
            {manifesto.map((line, i) => (
              <motion.p
                key={i}
                className="text-3xl font-bold leading-tight text-sand-100 sm:text-4xl md:text-5xl"
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
              >
                {line.includes("NODE")
                  ? line.split("NODE").map((part, j, arr) => (
                    <span key={j}>
                      {part}
                      {j < arr.length - 1 && (
                        <span className="font-brand">NODE</span>
                      )}
                    </span>
                  ))
                  : line}
              </motion.p>
            ))}
          </div>
        </div>
      </section>

      {/* Info Cards */}
      <section className="px-6 pb-32">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            {
              title: "Create",
              desc: "Installations, music curation, fashion, whatever you've got. Express it here.",
              gradient: "from-pink-500/20 to-orange/20",
            },
            {
              title: "Connect",
              desc: "Strangers become soulmates. Groups of friends become family. That's the whole point.",
              gradient: "from-amber/20 to-golden/20",
            },
            {
              title: "Contribute",
              desc: "Everyone has a role. Build week, kitchen shifts, strike day — we rise by lifting others.",
              gradient: "from-coral/20 to-pink-500/20",
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
