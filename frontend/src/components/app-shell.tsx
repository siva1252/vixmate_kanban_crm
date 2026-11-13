"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Handshake,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ScrollText,
  Sun,
  UserRound,
  Users,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearTokens, getAccessToken } from "@/lib/api";
import { getSession, logout, refreshSession } from "@/mock-services/auth";
import { cn } from "@/lib/utils";

function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
      <span className="relative inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-black shadow-sm ring-1 ring-stone-900/10">
        <Image
          src="/brand/viximate-logo.png"
          alt="Viximate"
          width={36}
          height={36}
          className="h-full w-full object-cover"
          priority
        />
      </span>
      {!collapsed ? (
        <div className="min-w-0">
          <p className="font-display text-xl leading-none tracking-tight text-teal-900 dark:text-teal-200">
            Viximate
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-stone-500">CRM</p>
        </div>
      ) : null}
    </div>
  );
}

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/boards", label: "Boards", icon: KanbanSquare },
  { href: "/team", label: "Teams", icon: Users },
  { href: "/lead-source", label: "Lead Source", icon: Handshake },
  { href: "/activity", label: "Active Logs", icon: ScrollText },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Require a real access token + live /me — not forgeable localStorage JSON alone.
      if (!getAccessToken()) {
        clearTokens();
        if (!cancelled) {
          setAuthed(false);
          router.replace("/login");
        }
        return;
      }
      const live = await refreshSession();
      if (cancelled) return;
      if (!live) {
        setAuthed(false);
        router.replace("/login");
        return;
      }
      setName(live.fullName || getSession()?.fullName || "");
      setAuthed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Warm route chunks + API cache so tab clicks skip loaders when possible.
  useEffect(() => {
    if (authed !== true) return;
    for (const link of links) {
      try {
        router.prefetch(link.href);
      } catch {
        // ignore
      }
    }
    const ac = new AbortController();
    void (async () => {
      try {
        const [{ fetchCrmConfig }, { fetchTeamMembers }, { fetchKanbanBoard }, { listClients }, { fetchActivityLogs }, { fetchLeadSourcePeople }] =
          await Promise.all([
            import("@/services/configuration"),
            import("@/services/team"),
            import("@/services/kanban"),
            import("@/services/clients"),
            import("@/services/activity"),
            import("@/services/lead-source"),
          ]);
        await Promise.allSettled([
          fetchCrmConfig(ac.signal),
          fetchTeamMembers(ac.signal),
          fetchKanbanBoard({}, ac.signal),
          listClients({}, ac.signal),
          fetchActivityLogs({ page_size: 100 }, ac.signal),
          fetchLeadSourcePeople({ status: "active" }, ac.signal),
        ]);
      } catch {
        // warm-up is best-effort
      }
    })();
    return () => ac.abort();
  }, [authed, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (authed === false) {
    return <div className="grid h-dvh place-items-center text-stone-500">Redirecting…</div>;
  }

  const NavLinks = ({ collapsed = false }: { collapsed?: boolean }) => (
    <nav className="space-y-1">
      {links.map((link) => {
        const Icon = link.icon;
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            prefetch
            title={link.label}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
              collapsed && "justify-center px-2",
              active
                ? "bg-teal-900 text-white shadow-sm"
                : "text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-900"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed ? <span>{link.label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top_left,#d9efe8,transparent_40%),linear-gradient(180deg,#f7f4ef,#eef2f0)] text-stone-900 dark:bg-[radial-gradient(circle_at_top_left,#0f2f2a,transparent_35%),linear-gradient(180deg,#121212,#1a1f1d)] dark:text-stone-100">
      <div className="flex h-full w-full">
        <aside
          className={cn(
            "hidden h-full shrink-0 flex-col border-r border-stone-200/80 bg-white/80 backdrop-blur transition-all duration-200 dark:border-stone-800 dark:bg-stone-950/70 md:flex",
            desktopOpen ? "w-64" : "w-[72px]"
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between gap-2 border-b border-stone-200/70 p-4 dark:border-stone-800",
              !desktopOpen && "flex-col px-2"
            )}
          >
            <BrandMark collapsed={!desktopOpen} />
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => setDesktopOpen((v) => !v)}
              aria-label={desktopOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {desktopOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <NavLinks collapsed={!desktopOpen} />
          </div>
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              className="absolute inset-0 bg-stone-950/40"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-white shadow-xl dark:bg-stone-950">
              <div className="flex items-center justify-between border-b border-stone-200 p-4 dark:border-stone-800">
                <BrandMark />
                <Button variant="ghost" size="sm" onClick={() => setMobileOpen(false)} aria-label="Close sidebar">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <NavLinks />
              </div>
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200/80 bg-white/70 px-3 py-3 backdrop-blur dark:border-stone-800 dark:bg-stone-950/50 sm:px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                className="md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open sidebar"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <span className="relative hidden h-8 w-8 shrink-0 overflow-hidden rounded-md bg-black ring-1 ring-stone-900/10 sm:inline-flex md:hidden">
                <Image
                  src="/brand/viximate-logo.png"
                  alt="Viximate"
                  width={32}
                  height={32}
                  className="h-full w-full object-cover"
                />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-stone-500 sm:text-sm">Signed in as</p>
                <p className="truncate font-medium">{name || "…"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void (async () => {
                    await logout();
                    router.replace("/login");
                  })();
                }}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-auto">
            {authed === null ? (
              <div className="grid h-full place-items-center text-sm text-stone-500">Loading…</div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
