"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const campPhotos = Array.from({ length: 47 }, (_, i) => ({
  src: `/images/gallery/camp/camp-${String(i + 1).padStart(2, "0")}.jpg`,
})).filter((p) => p.src !== "/images/gallery/camp/camp-30.jpg");

const bbqPhotos = Array.from({ length: 12 }, (_, i) => ({
  src: `/images/gallery/bbq/bbq-${String(i + 1).padStart(2, "0")}.jpg`,
}));

const allPhotos = [...campPhotos, ...bbqPhotos];

function Lightbox({
  photos,
  index,
  onClose,
  onChange,
}: {
  photos: { src: string }[];
  index: number;
  onClose: () => void;
  onChange: (i: number) => void;
}) {
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const prev = useCallback(
    () => onChange(index > 0 ? index - 1 : photos.length - 1),
    [index, photos.length, onChange]
  );
  const next = useCallback(
    () => onChange(index < photos.length - 1 ? index + 1 : 0),
    [index, photos.length, onChange]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, prev, next]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStart === null) return;
        const diff = e.changedTouches[0].clientX - touchStart;
        if (Math.abs(diff) > 50) {
          diff > 0 ? prev() : next();
        }
        setTouchStart(null);
      }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-sand-300 transition-colors hover:text-white"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-sm text-sand-400">
        {index + 1} / {photos.length}
      </div>

      {/* Prev */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          prev();
        }}
        className="absolute left-3 z-10 rounded-full bg-black/50 p-2 text-sand-300 transition-colors hover:text-white sm:left-6"
        aria-label="Previous photo"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      {/* Image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={photos[index].src}
          className="relative h-[80vh] w-[90vw] max-w-5xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Image
            src={photos[index].src}
            alt=""
            fill
            className="object-contain"
            sizes="90vw"
            priority
          />
        </motion.div>
      </AnimatePresence>

      {/* Next */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          next();
        }}
        className="absolute right-3 z-10 rounded-full bg-black/50 p-2 text-sand-300 transition-colors hover:text-white sm:right-6"
        aria-label="Next photo"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </motion.div>
  );
}

function PhotoCard({
  src,
  index,
  onClick,
}: {
  src: string;
  index: number;
  onClick: () => void;
}) {
  return (
    <motion.div
      className="relative aspect-square cursor-pointer overflow-hidden rounded-2xl"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.03 }}
      onClick={onClick}
    >
      <Image
        src={src}
        alt=""
        fill
        className="object-cover transition-transform duration-500 hover:scale-105"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      />
    </motion.div>
  );
}

export default function PicsClient() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <main className="min-h-screen px-4 py-20 sm:px-6 sm:py-24">
      {/* Header */}
      <section className="mx-auto max-w-3xl text-center">
        <motion.h1
          className="text-5xl font-bold text-gradient-warm sm:text-6xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Gallery
        </motion.h1>
        <motion.p
          className="mt-6 text-lg text-sand-300"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Moments from the playa, preserved in pixels.
        </motion.p>
      </section>

      {/* Camp Photos Gallery */}
      <section className="mx-auto mt-16 max-w-6xl">
        <motion.h2
          className="mb-8 text-center text-sm font-medium uppercase tracking-[0.3em] text-pink-400"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Camp Life
        </motion.h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {campPhotos.map((photo, i) => (
            <PhotoCard
              key={photo.src}
              src={photo.src}
              index={i}
              onClick={() => setLightboxIndex(i)}
            />
          ))}
        </div>
      </section>

      {/* Hip Hop BBQ Gallery */}
      <section className="mx-auto mt-24 max-w-6xl">
        <motion.h2
          className="mb-4 text-center text-sm font-medium uppercase tracking-[0.3em] text-pink-400"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Big Pete&apos;s Hip-Hop BBQ
        </motion.h2>
        <motion.p
          className="mb-8 text-center text-sand-400"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Our signature event — beats, eats, and community.
        </motion.p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {bbqPhotos.map((photo, i) => (
            <PhotoCard
              key={photo.src}
              src={photo.src}
              index={i}
              onClick={() => setLightboxIndex(campPhotos.length + i)}
            />
          ))}
        </div>
      </section>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <Lightbox
            photos={allPhotos}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onChange={setLightboxIndex}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
