"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Home,
  Users,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Menu,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/about", label: "About", icon: Users },
  { href: "/vibes", label: "Vibes", icon: Sparkles },
  { href: "/pics", label: "Pics", icon: ImageIcon },
  { href: "/apply", label: "Apply", icon: FileText },
];

export function FloatingDock() {
  return (
    <>
      <DesktopDock />
      <MobileDock />
    </>
  );
}

function DesktopDock() {
  const pathname = usePathname();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <nav className="fixed bottom-6 left-1/2 z-50 hidden -translate-x-1/2 md:flex">
      <motion.div
        className="glass flex items-center gap-1 rounded-full px-3 py-2"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.5 }}
      >
        {navItems.map((item, index) => {
          const isActive = pathname === item.href;
          const isHovered = hoveredIndex === index;
          const isNeighbor =
            hoveredIndex !== null && Math.abs(hoveredIndex - index) === 1;

          const scale = isHovered ? 1.4 : isNeighbor ? 1.15 : 1;

          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                className={`relative flex flex-col items-center justify-center rounded-full p-3 transition-colors ${
                  isActive
                    ? "bg-pink-500/20 text-pink-400"
                    : "text-sand-300 hover:text-sand-100"
                }`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                animate={{ scale }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <item.icon className="h-5 w-5" />
                {/* Tooltip label */}
                {isHovered && (
                  <motion.span
                    className="absolute -top-8 whitespace-nowrap rounded-md bg-blue-900/90 px-2 py-1 text-xs text-sand-200"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {item.label}
                  </motion.span>
                )}
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    className="absolute -bottom-1 h-1 w-1 rounded-full bg-pink-500"
                    layoutId="dock-active"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </motion.div>
    </nav>
  );
}

function MobileDock() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            className="glass glow-pink rounded-full p-4 text-pink-400"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="glass border-t-pink-500/20">
          <nav className="flex flex-col gap-2 pb-8 pt-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                    isActive
                      ? "bg-pink-500/20 text-pink-400"
                      : "text-sand-300 hover:bg-pink-500/10 hover:text-sand-100"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
