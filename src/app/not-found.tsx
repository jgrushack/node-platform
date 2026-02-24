"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative mb-8"
      >
        <div className="absolute inset-0 blur-3xl">
          <div className="h-full w-full rounded-full bg-amber/20" />
        </div>
        <Image
          src="/node-mark.svg"
          alt="NODE"
          width={80}
          height={80}
          className="relative z-10 opacity-50"
        />
      </motion.div>

      <motion.h1
        className="text-7xl font-bold text-gradient-warm sm:text-8xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        404
      </motion.h1>

      <motion.p
        className="mt-4 text-xl text-sand-300"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        Lost in the desert.
      </motion.p>

      <motion.p
        className="mt-2 text-sand-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        This page doesn&apos;t exist — but the playa is vast and full of
        wonders.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8"
      >
        <Link href="/">
          <Button className="rounded-full bg-pink-500 text-white hover:bg-pink-600 glow-pink">
            <Home className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
      </motion.div>
    </main>
  );
}
