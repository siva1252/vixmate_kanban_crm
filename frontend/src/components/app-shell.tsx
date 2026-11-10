"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Moon,
  Paperclip,
  Phone,
  Settings,
  Sun,
  Users,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession, logout } from "@/mock-services/auth";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kanban", label: "Kanban", icon: KanbanSquare },
  { href: "/leads", label: "Leads", icon: ClipboardList },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/meetings", label: "Meetings", icon: CalendarDays },
  { href: "/followups", label: "Follow-ups", icon: Phone },
  { href: "/team", label: "Team", icon: Users },
  { href: "/assignments", label: "Assignments", icon: UserRound },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/attachments", label: "Attachments", icon: Paperclip },
  { href: "/profile", label: "Profile", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setName(session.fullName);
    setReady(true);
  }, [router, pathname]);

  if (!ready) {
    return <div className="grid min-h-screen place-items-center text-stone-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#d9efe8,transparent_40%),linear-gradient(180deg,#f7f4ef,#eef2f0)] text-stone-900 dark:bg-[radial-gradient(circle_at_top_left,#0f2f2a,transparent_35%),linear-gradient(180deg,#121212,#1a1f1d)] dark:text-stone-100">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        <aside className="hidden w-64 shrink-0 border-r border-stone-200/80 bg-white/70 p-4 backdrop-blur dark:border-stone-800 dark:bg-stone-950/60 md:block">
          <div className="mb-8">
            <p className="font-display text-2xl tracking-tight text-teal-900 dark:text-teal-200">
              Viximate
            </p>
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">CRM · Mock Mode</p>
          </div>
          <nav className="space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition",
                    active
                      ? "bg-teal-900 text-white"
                      : "text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-900"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-stone-200/80 bg-white/60 px-4 py-3 backdrop-blur dark:border-stone-800 dark:bg-stone-950/50">
            <div>
              <p className="text-sm text-stone-500">Signed in as</p>
              <p className="font-medium">{name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout();
                  router.replace("/login");
                }}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
