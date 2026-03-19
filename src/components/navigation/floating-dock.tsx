"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Sparkles,
  Image as ImageIcon,
  FileText,
  LogIn,
  LayoutDashboard,
  Briefcase,
  User,
  LogOut,
} from "lucide-react";

function NodeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M159.877 142.281C170.898 149.217 174.209 163.776 167.274 174.799L50.691 360.083C43.7555 371.105 29.1993 374.418 18.1787 367.481C7.15811 360.544 3.84646 345.986 10.7819 334.963L127.365 149.679C134.3 138.656 148.857 135.344 159.877 142.281Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M213.086 238.849C224.065 245.852 227.288 260.43 220.286 271.411L160.529 365.117C153.527 376.097 138.951 379.321 127.973 372.318C116.994 365.315 113.771 350.736 120.773 339.756L180.53 246.049C187.532 235.069 202.108 231.845 213.086 238.849Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M270.61 331.96C280.923 339.91 282.84 354.717 274.892 365.033L274.635 365.366C266.686 375.681 251.882 377.599 241.568 369.648C231.254 361.698 229.337 346.891 237.286 336.576L237.543 336.243C245.491 325.927 260.296 324.01 270.61 331.96Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M352.348 369.716C341.328 362.78 338.016 348.221 344.952 337.198L461.535 151.914C468.47 140.892 483.026 137.58 494.047 144.516C505.067 151.453 508.379 166.012 501.444 177.034L384.861 362.318C377.925 373.341 363.369 376.653 352.348 369.716Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M299.139 273.149C288.161 266.145 284.938 251.567 291.94 240.587L351.696 146.88C358.698 135.9 373.274 132.676 384.253 139.679C395.231 146.682 398.454 161.261 391.452 172.241L331.696 265.948C324.694 276.928 310.118 280.152 299.139 273.149Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M241.616 180.036C231.302 172.086 229.385 157.279 237.334 146.963L237.591 146.63C245.539 136.315 260.344 134.398 270.657 142.348C280.971 150.298 282.888 165.105 274.94 175.42L274.683 175.753C266.734 186.069 251.93 187.986 241.616 180.036Z" fill="currentColor"/>
    </svg>
  );
}
import { createClient } from "@/lib/supabase/client";

function NodeIcon({ className }: { className?: string }) {
  return <NodeLogo className={className} />;
}

const publicNavItems = [
  { href: "/", label: "Home", icon: NodeIcon },
  { href: "/about", label: "About", icon: Users },
  { href: "/vibes", label: "Vibes", icon: Sparkles },
  { href: "/pics", label: "Gallery", icon: ImageIcon },
  { href: "/apply", label: "Apply", icon: FileText },
];

const memberNavItems = [
  { href: "/", label: "Home", icon: NodeIcon },
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
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = user ? memberNavItems : publicNavItems;

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <nav className="fixed top-6 left-1/2 z-50 hidden -translate-x-1/2 md:flex items-center gap-3 whitespace-nowrap">
      {/* Main nav pill */}
      <AnimatePresence mode="wait">
        <motion.div
          key={user ? "member" : "public"}
          className={`flex items-center gap-1 rounded-full px-3 py-2 ${
            user
              ? "glass-dock-member"
              : "glass-dock-nav"
          }`}
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
        >
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  className={`relative flex items-center gap-2 rounded-full px-3 py-2 transition-colors ${
                    isActive
                      ? user
                        ? "bg-amber/20 text-amber"
                        : "bg-pink-500/20 text-pink-400"
                      : "text-sand-300 hover:text-sand-100"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{item.label}</span>
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
                className="flex items-center gap-2 rounded-full px-3 py-2 text-sand-400 hover:text-red-400 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-medium">Log out</span>
              </motion.button>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Separate login button — only when logged out */}
      {!loading && !user && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.7 }}
        >
          <Link href="/login">
            <motion.div
              className="glass-dock-login flex items-center gap-2 rounded-full px-4 py-2.5 text-sand-100 transition-colors hover:text-amber"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <LogIn className="h-4 w-4" />
              <span className="text-sm font-medium">Log in</span>
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
  const [loggingOut, setLoggingOut] = useState(false);
  const [visible, setVisible] = useState(true);

  const navItems = user ? memberNavItems : publicNavItems;

  useEffect(() => {
    let lastY = window.scrollY;
    function onScroll() {
      const currentY = window.scrollY;
      setVisible(currentY < lastY || currentY < 50);
      lastY = currentY;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <motion.nav
      className="fixed bottom-6 left-1/2 z-50 md:hidden -translate-x-1/2"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: visible ? 0 : 100, opacity: visible ? 1 : 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 25 }}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-1 rounded-full px-3 py-2 ${
            user ? "glass-dock-member" : "glass-dock-nav"
          }`}
        >
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center justify-center rounded-full p-3 transition-colors ${
                    isActive
                      ? user
                        ? "bg-amber/20 text-amber"
                        : "bg-pink-500/20 text-pink-400"
                      : "text-sand-300 active:text-sand-100"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                </div>
              </Link>
            );
          })}

          {user && (
            <>
              <div className="mx-0.5 h-6 w-px bg-sand-400/20" />
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center justify-center rounded-full p-3 text-sand-400 active:text-red-400 transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {!loading && !user && (
          <Link href="/login">
            <div className="glass-dock-login flex h-[48px] w-[48px] items-center justify-center rounded-full text-sand-100">
              <LogIn className="h-5 w-5" />
            </div>
          </Link>
        )}
      </div>
    </motion.nav>
  );
}
