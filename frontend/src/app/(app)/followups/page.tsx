"use client";

import { followups, TEAM } from "@/mock-data/store";

export default function FollowupsPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Follow-ups</h1>
      <p className="text-sm text-stone-500">Manual follow-up records only — no reminder automation.</p>
      <ul className="space-y-2">
        {followups.map((f) => (
          <li key={f.id} className="rounded-lg border bg-white/80 p-3 dark:border-stone-800 dark:bg-stone-950/60">
            <p className="font-medium">{f.followUpDate} · {f.status}</p>
            <p className="text-sm">{f.notes}</p>
            <p className="text-xs text-stone-500">
              Updated by {TEAM.find((t) => t.id === f.updatedById)?.displayName}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
