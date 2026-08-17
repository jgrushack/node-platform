"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Full-screen "WE'RE GOING TO BURNING MAN" moment — canvas confetti burst,
 * giant staggered letters, tap anywhere to dismiss. No external deps.
 */
export function Celebration({
  open,
  onClose,
  firstName,
}: {
  open: boolean;
  onClose: () => void;
  firstName?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const COLORS = ["#F90077", "#FF3399", "#FFB800", "#FBA52C", "#F9EDD8", "#7C3AED"];
    type P = {
      x: number; y: number; vx: number; vy: number;
      w: number; h: number; rot: number; vr: number;
      color: string; life: number; shape: "rect" | "circle" | "strip";
    };
    const parts: P[] = [];
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const burst = (x: number, y: number, n: number, spread = Math.PI, base = -Math.PI / 2, power = 14) => {
      for (let i = 0; i < n; i++) {
        const angle = base + (Math.random() - 0.5) * spread;
        const speed = power * (0.4 + Math.random() * 0.9);
        parts.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          w: 6 + Math.random() * 8,
          h: 8 + Math.random() * 12,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.4,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          life: 1,
          shape: (["rect", "circle", "strip"] as const)[(Math.random() * 3) | 0],
        });
      }
    };

    // Opening salvo: bottom corners + centre.
    burst(W() * 0.5, H() * 0.65, 160, Math.PI * 0.9, -Math.PI / 2, 18);
    burst(0, H(), 90, Math.PI / 2, -Math.PI / 4, 20);
    burst(W(), H(), 90, Math.PI / 2, (-3 * Math.PI) / 4, 20);

    // Slow rain afterwards.
    const rainTimer = window.setInterval(() => {
      for (let i = 0; i < 6; i++) {
        parts.push({
          x: Math.random() * W(), y: -20,
          vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
          w: 6 + Math.random() * 6, h: 8 + Math.random() * 10,
          rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.3,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          life: 1, shape: (["rect", "circle", "strip"] as const)[(Math.random() * 3) | 0],
        });
      }
    }, 120);
    // Second burst on beat.
    const encore = window.setTimeout(() => {
      burst(W() * 0.25, H() * 0.4, 80, Math.PI * 0.8, -Math.PI / 2, 15);
      burst(W() * 0.75, H() * 0.4, 80, Math.PI * 0.8, -Math.PI / 2, 15);
    }, 900);

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, W(), H());
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vy += 0.35; // gravity
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > H() + 40) { parts.splice(i, 1); continue; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        if (p.shape === "circle") {
          ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill();
        } else if (p.shape === "strip") {
          ctx.fillRect(-p.w / 4, -p.h, p.w / 2, p.h * 2);
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const hint = window.setTimeout(() => setShowHint(true), 1800);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(rainTimer);
      window.clearTimeout(encore);
      window.clearTimeout(hint);
      window.removeEventListener("resize", resize);
      setShowHint(false);
    };
  }, [open]);

  const line1 = "WE'RE GOING TO";
  const line2 = "BURNING MAN";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="celebration"
          role="dialog"
          aria-label="You're ready for Burning Man"
          className="fixed inset-0 z-[100] flex cursor-pointer select-none flex-col items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-blue-950/90 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          />
          {/* Radial flash */}
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,184,0,0.55) 0%, rgba(249,0,119,0.35) 25%, rgba(15,1,32,0) 60%)",
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1, opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />

          <div className="relative z-10 px-4 text-center">
            {firstName && (
              <motion.p
                className="mb-4 text-xs font-medium uppercase tracking-[0.4em] text-sand-300 sm:text-sm"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {firstName}, every box is checked.
              </motion.p>
            )}
            <Line text={line1} delay={0.35} className="text-3xl sm:text-5xl md:text-6xl" />
            <Line
              text={line2}
              delay={0.85}
              className="mt-2 bg-gradient-to-r from-pink-500 via-pink-400 to-amber bg-clip-text text-transparent text-5xl sm:text-7xl md:text-8xl lg:text-9xl"
              glow
            />
            <motion.p
              className="mx-auto mt-8 max-w-sm text-sm text-sand-300 sm:text-base"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6, duration: 0.5 }}
            >
              You&apos;re locked in for NODE 2026. See you in the dust.
            </motion.p>
            <motion.p
              className="mt-10 text-xs uppercase tracking-[0.3em] text-sand-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: showHint ? 1 : 0 }}
              transition={{ duration: 0.6 }}
            >
              tap anywhere
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Line({
  text,
  delay,
  className,
  glow,
}: {
  text: string;
  delay: number;
  className?: string;
  glow?: boolean;
}) {
  const words = text.split(" ");
  let i = 0;
  return (
    <h2
      className={`font-heading font-bold uppercase leading-[0.95] tracking-tight ${className ?? ""}`}
      style={
        glow
          ? { filter: "drop-shadow(0 0 24px rgba(249,0,119,0.55)) drop-shadow(0 0 60px rgba(255,184,0,0.35))" }
          : undefined
      }
    >
      {words.map((w, wi) => (
        <span key={wi} className="inline-block whitespace-nowrap">
          {w.split("").map((ch) => {
            const idx = i++;
            return (
              <motion.span
                key={idx}
                className="inline-block"
                initial={{ opacity: 0, y: 40, rotateX: -60, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
                transition={{
                  delay: delay + idx * 0.045,
                  type: "spring",
                  stiffness: 420,
                  damping: 22,
                }}
              >
                {ch}
              </motion.span>
            );
          })}
          {wi < words.length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
    </h2>
  );
}
