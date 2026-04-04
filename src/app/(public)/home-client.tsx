"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomeClient() {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
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
      <section className="px-4 pb-24 sm:px-6 sm:pb-32">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            {
              title: "Create",
              desc: "Installations, music curation, fashion, whatever you're into. Express it at NODE.",
              gradient: "from-pink-500/20 to-orange/20",
            },
            {
              title: "Connect",
              desc: "Strangers become soulmates. Friends become family. A year-round community.",
              gradient: "from-amber/20 to-golden/20",
            },
            {
              title: "Contribute",
              desc: "Everyone has a role. Everyone has responsibility. We rise by lifting others.",
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
