"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { fetchTeamMembers } from "@/services/team";
import type { TeamMember } from "@/types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = members.find((m) => m.id === selectedId) ?? null;

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const rows = await fetchTeamMembers(ac.signal);
        setMembers(rows);
      } catch (err) {
        if (ac.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load team");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Teams</h1>
          <p className="text-sm text-stone-500">
            CRM team members from the database — open a person for details.
          </p>
        </div>
        <p className="text-sm font-medium text-stone-700 dark:text-stone-200">
          {loading ? "Loading…" : `${members.length} member${members.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => setSelectedId(m.id)}
              className={cn(
                "w-full rounded-xl border border-stone-200 bg-white/80 p-4 text-left transition hover:border-teal-700/40 hover:shadow-sm dark:border-stone-800 dark:bg-stone-950/50",
                selectedId === m.id && "border-teal-800 ring-1 ring-teal-800/30"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-teal-900 text-sm font-semibold text-white">
                  {initials(m.displayName)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-xl tracking-tight">{m.displayName}</p>
                  <p className="truncate text-sm text-stone-500">{m.jobTitle || "Team"}</p>
                </div>
              </div>
              <p className="mt-3 truncate text-sm text-stone-600 dark:text-stone-300">{m.email}</p>
              <p className="mt-2 text-xs text-stone-500">{m.isActive ? "Active member" : "Inactive"}</p>
            </button>
          </li>
        ))}
      </ul>

      {!loading && members.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
          No team members found. Run seed_demo_users on the backend.
        </p>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/40 p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0" onClick={() => setSelectedId(null)} aria-hidden />
          <div className="relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-stone-200 bg-white shadow-xl dark:border-stone-800 dark:bg-stone-950 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-stone-200 p-4 dark:border-stone-800">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-teal-900 text-sm font-semibold text-white">
                  {initials(selected.displayName)}
                </span>
                <div>
                  <h2 className="font-display text-2xl tracking-tight">{selected.displayName}</h2>
                  <p className="text-sm text-stone-500">{selected.jobTitle || "Team member"}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3 overflow-y-auto p-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-stone-500">Email</p>
                <p className="mt-1 break-all">{selected.email}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-stone-500">Availability</p>
                <p className="mt-1 capitalize">{selected.availabilityStatus.replaceAll("_", " ")}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-stone-500">Status</p>
                <p className="mt-1">{selected.isActive ? "Active" : "Inactive"}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
