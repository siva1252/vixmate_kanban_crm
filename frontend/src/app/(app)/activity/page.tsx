"use client";

import { activities, TEAM } from "@/mock-data/store";

export default function ActivityPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Global activity logs</h1>
      <div className="overflow-hidden rounded-xl border bg-white/80 dark:border-stone-800 dark:bg-stone-950/60">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-100 text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a) => (
              <tr key={a.id} className="border-t dark:border-stone-800">
                <td className="px-3 py-2">{new Date(a.timestamp).toLocaleString()}</td>
                <td className="px-3 py-2">
                  {TEAM.find((t) => t.id === a.actorId)?.displayName ?? "—"}
                </td>
                <td className="px-3 py-2">{a.action}</td>
                <td className="px-3 py-2">
                  {a.entityType}:{a.entityId}
                </td>
                <td className="px-3 py-2">{a.reason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
