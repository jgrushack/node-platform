"use client";

import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Category = {
  id: string;
  label: string;
  slug: string;
  count: number;
  /** photo numbers to skip (e.g., gaps in the camp folder) */
  skip?: number[];
  /** photo numbers that are .png instead of .jpg */
  png?: number[];
};

const categories: Category[] = [
  { id: "camp", label: "Camp Life", slug: "camp", count: 47, skip: [11, 23, 24, 30, 32] },
  { id: "bbq", label: "Hip-Hop BBQ", slug: "bbq", count: 12 },
  { id: "music", label: "Music", slug: "music", count: 16 },
  { id: "yoga", label: "Morning Yoga", slug: "yoga", count: 14 },
  { id: "coffee", label: "Rocket Fuel Coffee", slug: "coffee", count: 10, png: [10] },
  { id: "pickle", label: "Pickle Ball 2025", slug: "pickle", count: 10, png: [10] },
  { id: "croquet", label: "Rose & Croquet 2024", slug: "croquet", count: 12 },
  { id: "reno", label: "Reno Pre-Builds", slug: "reno", count: 20, skip: [7] },
];

function buildPhotos(cat: Category): { src: string }[] {
  const photos: { src: string }[] = [];
  for (let i = 1; i <= cat.count; i++) {
    if (cat.skip?.includes(i)) continue;
    const num = String(i).padStart(2, "0");
    const ext = cat.png?.includes(i) ? "png" : "jpg";
    photos.push({ src: `/images/gallery/${cat.slug}/${cat.slug}-${num}.${ext}` });
  }
  return photos;
}

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
          if (diff > 0) prev();
          else next();
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
      transition={{ duration: 0.4, delay: Math.min(index * 0.02, 0.3) }}
      onClick={onClick}
    >
      <Image
        src={src}
        alt=""
        fill
        className="object-cover transition-transform duration-500 hover:scale-105"
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
      />
    </motion.div>
  );
}

export default function PicsClient() {
  const [activeId, setActiveId] = useState<string>(categories[0].id);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === activeId) ?? categories[0],
    [activeId]
  );
  const photos = useMemo(() => buildPhotos(activeCategory), [activeCategory]);

  // Reset lightbox if user switches categories
  useEffect(() => {
    setLightboxIndex(null);
  }, [activeId]);

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

      {/* Sub-nav: category tabs — uses CSS Grid so the 8 items always split evenly (4×2 on small viewports, 2×4 on tablet+) instead of leaving an odd one on its own row */}
      <nav
        aria-label="Gallery categories"
        className="mx-auto mt-12 max-w-6xl py-2"
      >
        <ul className="mx-auto grid grid-cols-2 justify-items-center gap-x-1 gap-y-2 px-2 py-1 sm:grid-cols-4 sm:gap-x-2">
          {categories.map((cat) => {
            const isActive = cat.id === activeId;
            return (
              <li key={cat.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(cat.id)}
                  aria-pressed={isActive}
                  className={`relative whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors sm:text-base ${
                    isActive
                      ? "text-sand-100"
                      : "text-sand-400 hover:text-sand-200"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="gallery-tab-pill"
                      className="absolute inset-0 rounded-full bg-pink-500/20 ring-1 ring-pink-400/60"
                      transition={{ type: "spring", duration: 0.45, bounce: 0.2 }}
                    />
                  )}
                  <span className="relative z-10">{cat.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Active gallery */}
      <section className="mx-auto mt-10 max-w-6xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((photo, i) => (
                <PhotoCard
                  key={photo.src}
                  src={photo.src}
                  index={i}
                  onClick={() => setLightboxIndex(i)}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* Lightbox — scoped to current category */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <Lightbox
            photos={photos}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onChange={setLightboxIndex}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
