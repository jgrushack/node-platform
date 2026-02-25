"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Users,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Menu,
  X,
  LogIn,
  LayoutDashboard,
  Briefcase,
  User,
  LogOut,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";

const publicNavItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/about", label: "About", icon: Users },
  { href: "/vibes", label: "Vibes", icon: Sparkles },
  { href: "/pics", label: "Pics", icon: ImageIcon },
  { href: "/apply", label: "Apply", icon: FileText },
];

const memberNavItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/jobs", label: "Jobs", icon: Briefcase },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

export function FloatingDock() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ? { id: u.id, email: u.email ?? undefined } : null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(
          session?.user
            ? { id: session.user.id, email: session.user.email ?? undefined }
            : null
        );
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <DesktopDock user={user} loading={loading} />
      <MobileDock user={user} loading={loading} />
    </>
  );
}

type DockUser = { id: string; email?: string } | null;

function DesktopDock({ user, loading }: { user: DockUser; loading: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = user ? memberNavItems : publicNavItems;

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <nav className="fixed bottom-6 left-1/2 z-50 hidden -translate-x-1/2 md:flex items-center gap-3">
      {/* Main nav pill */}
      <AnimatePresence mode="wait">
        <motion.div
          key={user ? "member" : "public"}
          className={`flex items-center gap-1 rounded-full px-3 py-2 ${
            user
              ? "glass-dock-member"
              : "glass"
          }`}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
        >
          {navItems.map((item, index) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const isHovered = hoveredIndex === index;
            const isNeighbor =
              hoveredIndex !== null && Math.abs(hoveredIndex - index) === 1;
            const scale = isHovered ? 1.4 : isNeighbor ? 1.15 : 1;

            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  className={`relative flex flex-col items-center justify-center rounded-full p-3 transition-colors ${
                    isActive
                      ? user
                        ? "bg-amber/20 text-amber"
                        : "bg-pink-500/20 text-pink-400"
                      : "text-sand-300 hover:text-sand-100"
                  }`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  animate={{ scale }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <item.icon className="h-5 w-5" />
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
                  {isActive && (
                    <motion.div
                      className={`absolute -bottom-1 h-1 w-1 rounded-full ${
                        user ? "bg-amber" : "bg-pink-500"
                      }`}
                      layoutId="dock-active"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}

          {/* Logout button inside member dock */}
          {user && (
            <>
              <div className="mx-1 h-6 w-px bg-sand-400/20" />
              <motion.button
                onClick={handleLogout}
                disabled={loggingOut}
                className="relative flex flex-col items-center justify-center rounded-full p-3 text-sand-400 hover:text-red-400 transition-colors"
                onMouseEnter={() => setHoveredIndex(navItems.length)}
                onMouseLeave={() => setHoveredIndex(null)}
                whileHover={{ scale: 1.2 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <LogOut className="h-5 w-5" />
                {hoveredIndex === navItems.length && (
                  <motion.span
                    className="absolute -top-8 whitespace-nowrap rounded-md bg-blue-900/90 px-2 py-1 text-xs text-sand-200"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    Log out
                  </motion.span>
                )}
              </motion.button>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Separate login button — only when logged out */}
      {!loading && !user && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.7 }}
        >
          <Link href="/login">
            <motion.div
              className="glass-dock-login flex h-[52px] w-[52px] items-center justify-center rounded-full text-sand-100 transition-colors hover:text-amber"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <LogIn className="h-5 w-5" />
            </motion.div>
          </Link>
        </motion.div>
      )}
    </nav>
  );
}

function MobileDock({ user, loading }: { user: DockUser; loading: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = user ? memberNavItems : publicNavItems;

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/");
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 md:hidden">
      {/* Login button on mobile */}
      {!loading && !user && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.7 }}
        >
          <Link href="/login">
            <div className="glass-dock-login flex h-14 w-14 items-center justify-center rounded-full text-sand-100">
              <LogIn className="h-5 w-5" />
            </div>
          </Link>
        </motion.div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            className={`rounded-full p-4 ${
              user ? "glass-dock-member glow-amber" : "glass glow-pink"
            } ${user ? "text-amber" : "text-pink-400"}`}
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className={`border-t ${
            user
              ? "glass-dock-member border-t-amber/20"
              : "glass border-t-pink-500/20"
          }`}
        >
          <nav className="flex flex-col gap-2 pb-8 pt-4">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                    isActive
                      ? user
                        ? "bg-amber/20 text-amber"
                        : "bg-pink-500/20 text-pink-400"
                      : user
                        ? "text-sand-300 hover:bg-amber/10 hover:text-sand-100"
                        : "text-sand-300 hover:bg-pink-500/10 hover:text-sand-100"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
            {user && (
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sand-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">
                  {loggingOut ? "Logging out..." : "Log out"}
                </span>
              </button>
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
