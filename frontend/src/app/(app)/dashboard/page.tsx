"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { STAGES, meetings, tasks } from "@/mock-data/store";
import { listClients } from "@/mock-services/clients";
import { activities } from "@/mock-data/store";

export default function DashboardPage() {
  const clients = listClients();
  const stageData = STAGES.map((stage) => ({
    name: stage.name,
    count: clients.filter((c) => c.stageId === stage.id).length,
  }));

  const stats = [
    { label: "Total leads", value: clients.length },
    { label: "New leads", value: stageData[0]?.count ?? 0 },
    { label: "Qualified", value: stageData[3]?.count ?? 0 },
    { label: "Pending tasks", value: tasks.filter((t) => t.status === "pending").length },
    { label: "Upcoming meetings", value: meetings.filter((m) => m.status === "scheduled").length },
    { label: "Won", value: stageData[7]?.count ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Dashboard</h1>
        <p className="text-sm text-stone-500">Mock analytics from local CRM state</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-stone-200 bg-white/80 p-4 dark:border-stone-800 dark:bg-stone-950/60">
            <p className="text-xs uppercase tracking-wide text-stone-500">{stat.label}</p>
            <p className="mt-2 font-display text-3xl">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-stone-200 bg-white/80 p-4 dark:border-stone-800 dark:bg-stone-950/60">
        <h2 className="mb-4 font-display text-xl">Leads by stage</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" hide />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#115e59" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl border border-stone-200 bg-white/80 p-4 dark:border-stone-800 dark:bg-stone-950/60">
        <h2 className="mb-3 font-display text-xl">Recent activities</h2>
        <ul className="space-y-2 text-sm">
          {activities.slice(0, 8).map((a) => (
            <li key={a.id} className="flex justify-between gap-3 border-b border-stone-100 py-2 dark:border-stone-800">
              <span>
                {a.action} · {a.entityType}
              </span>
              <span className="text-stone-500">{new Date(a.timestamp).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
