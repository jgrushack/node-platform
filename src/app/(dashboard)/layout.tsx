"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  User,
  LogOut,
  FileText,
  FolderOpen,
  CalendarDays,
  Menu,
  UsersRound,
  Eye,
  ArrowLeft,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";

const baseSidebarItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/members", label: "Members", icon: UsersRound },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/documents", label: "Documents", icon: FolderOpen },
  { href: "/dashboard/jobs", label: "Jobs", icon: Briefcase },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

const committeeItem = {
  href: "/dashboard/applications",
  label: "Applications",
  icon: FileText,
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCommittee, setIsCommittee] = useState(false);
  const [userInitials, setUserInitials] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [viewAsRole, setViewAsRole] = useState<string | null>(null);
  const [realRole, setRealRole] = useState<string | null>(null);

  useEffect(() => {
    // Check for view-as mode
    const stored = localStorage.getItem("viewAsRole");
    if (stored) setTimeout(() => setViewAsRole(stored), 0);

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      // Build initials from email or metadata
      const name = user.user_metadata?.full_name || user.email || "";
      const parts = name.split(/[\s@]/);
      setUserInitials(
        parts.length >= 2
          ? (parts[0][0] + parts[1][0]).toUpperCase()
          : name.substring(0, 2).toUpperCase()
      );
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          const role = data?.role || "member";
          setRealRole(role);

          // Use viewAs role for UI if super_admin, otherwise real role
          const effectiveRole =
            stored && role === "super_admin" ? stored : role;

          if (
            ["committee", "admin", "super_admin"].includes(effectiveRole)
          ) {
            setIsCommittee(true);
          }
        });
    });
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarItems = [baseSidebarItems[0], committeeItem, ...baseSidebarItems.slice(1)];

  const navLinks = (onNavigate?: () => void) =>
    sidebarItems.map((item) => {
      const isActive = pathname === item.href;
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive
              ? "bg-pink-500/15 text-pink-400"
              : "text-sand-300 hover:bg-pink-500/5 hover:text-sand-100"
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
      <aside className="hidden w-64 flex-col border-r border-pink-500/10 glass-sidebar md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-pink-500/10 px-6">
          <Image
            src="/node-mark.svg"
            alt="NODE"
            width={28}
            height={28}
          />
          <span className="text-lg font-bold font-brand text-sand-100">NODE</span>
        </div>
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">{navLinks()}</nav>
        </ScrollArea>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col">
        {/* Top header */}
        <header className="flex h-16 items-center justify-between border-b border-pink-500/10 px-4 md:px-6">
          {/* Mobile: hamburger + logo */}
          <div className="flex items-center gap-3 md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-sand-300 hover:bg-pink-500/10 hover:text-sand-100"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="glass w-64 border-r-pink-500/10 p-0">
                <div className="flex h-16 items-center gap-3 border-b border-pink-500/10 px-6">
                  <Image src="/node-mark.svg" alt="NODE" width={28} height={28} />
                  <SheetTitle className="text-lg font-bold font-brand text-sand-100">NODE</SheetTitle>
                </div>
                <nav className="space-y-1 px-3 py-4">
                  {navLinks(() => setMobileOpen(false))}
                </nav>
                <div className="absolute bottom-0 left-0 right-0 border-t border-pink-500/10 p-4">
                  <button
                    onClick={() => { setMobileOpen(false); handleLogout(); }}
                    disabled={loggingOut}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sand-300 hover:bg-pink-500/5 hover:text-sand-100"
                  >
                    <LogOut className="h-4 w-4" />
                    {loggingOut ? "Logging out..." : "Log out"}
                  </button>
                </div>
              </SheetContent>
            </Sheet>
            <Image src="/node-mark.svg" alt="NODE" width={24} height={24} />
          </div>
          <div className="hidden md:block" />
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-10 w-10 items-center justify-center rounded-full">
              <Avatar className="h-8 w-8 border border-pink-500/20">
                <AvatarFallback className="bg-pink-500/20 text-xs text-pink-400">
                  {userInitials || ".."}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass">
              <DropdownMenuItem className="text-sand-200">
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-sand-200"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {loggingOut ? "Logging out..." : "Log out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* View-as banner */}
        {viewAsRole && realRole === "super_admin" && (
          <div className="flex items-center justify-between bg-amber/15 px-4 py-2 md:px-6">
            <div className="flex items-center gap-2 text-sm text-amber">
              <Eye className="h-4 w-4" />
              <span>
                Viewing as{" "}
                <span className="font-semibold capitalize">
                  {viewAsRole.replace("_", " ")}
                </span>
              </span>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem("viewAsRole");
                setViewAsRole(null);
                router.push("/admin/users");
              }}
              className="flex items-center gap-1.5 rounded-full bg-amber/20 px-3 py-1 text-xs font-medium text-amber hover:bg-amber/30 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Exit Preview
            </button>
          </div>
        )}

        {/* Page content */}
        <ScrollArea className="flex-1">
          <main className="p-4 md:p-8">{children}</main>
        </ScrollArea>
      </div>
    </div>
  );
}
