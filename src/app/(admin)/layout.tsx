"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  LogOut,
  Menu,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";

const sidebarItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/applications", label: "Applications", icon: FileText },
  { href: "/admin/jobs", label: "Jobs", icon: Briefcase },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userInitials, setUserInitials] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const email = user.email || "";
      setUserEmail(email);
      const name = user.user_metadata?.full_name || email;
      const parts = name.split(/[\s@]/);
      setUserInitials(
        parts.length >= 2
          ? (parts[0][0] + parts[1][0]).toUpperCase()
          : name.substring(0, 2).toUpperCase()
      );
    });
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = (onNavigate?: () => void) =>
    sidebarItems.map((item) => {
      const isActive = pathname === item.href;
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive
              ? "bg-amber/15 text-amber"
              : "text-sand-300 hover:bg-amber/5 hover:text-sand-100"
          }`}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      );
    });

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-amber/10 glass-sidebar-admin md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-amber/10 px-6">
          <Image src="/node-mark.svg" alt="NODE" width={28} height={28} />
          <span className="text-lg font-bold text-sand-100">
            <span className="font-brand">NODE</span> <span className="text-xs text-amber">Admin</span>
          </span>
        </div>
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">{navLinks()}</nav>
        </ScrollArea>
        <div className="border-t border-amber/10 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 border border-amber/20">
              <AvatarFallback className="bg-amber/20 text-xs text-amber">
                {userInitials || ".."}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-sm">
              <p className="font-medium text-sand-200">Admin</p>
              <p className="text-xs text-sand-500 truncate">{userEmail || "..."}</p>
            </div>
            <button
              className="text-sand-400 hover:text-sand-200"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex h-14 items-center justify-between border-b border-amber/10 px-4 md:hidden">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-sand-300 hover:bg-amber/10 hover:text-sand-100"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="glass w-64 border-r-amber/10 p-0">
                <div className="flex h-16 items-center gap-3 border-b border-amber/10 px-6">
                  <Image src="/node-mark.svg" alt="NODE" width={28} height={28} />
                  <span className="text-lg font-bold text-sand-100">
                    <span className="font-brand">NODE</span> <span className="text-xs text-amber">Admin</span>
                  </span>
                </div>
                <nav className="space-y-1 px-3 py-4">
                  {navLinks(() => setMobileOpen(false))}
                </nav>
                <div className="absolute bottom-0 left-0 right-0 border-t border-amber/10 p-4">
                  <button
                    onClick={() => { setMobileOpen(false); handleLogout(); }}
                    disabled={loggingOut}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sand-300 hover:bg-amber/5 hover:text-sand-100"
                  >
                    <LogOut className="h-4 w-4" />
                    {loggingOut ? "Logging out..." : "Log out"}
                  </button>
                </div>
              </SheetContent>
            </Sheet>
            <Image src="/node-mark.svg" alt="NODE" width={24} height={24} />
            <span className="text-sm font-bold text-sand-100">
              <span className="font-brand">NODE</span> <span className="text-xs text-amber">Admin</span>
            </span>
          </div>
          <Avatar className="h-8 w-8 border border-amber/20">
            <AvatarFallback className="bg-amber/20 text-xs text-amber">
              {userInitials || ".."}
            </AvatarFallback>
          </Avatar>
        </header>

        {/* Main content */}
        <ScrollArea className="flex-1">
          <main className="p-4 md:p-8">{children}</main>
        </ScrollArea>
      </div>
    </div>
  );
}
