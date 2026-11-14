"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ApiError } from "@/lib/api";
import { cacheGet } from "@/lib/api-cache";
import { DATA_CHANGED_EVENT } from "@/lib/data-events";
import { formatDateTime } from "@/lib/utils";
import { fetchActivityLogs, type ActivityLogRow } from "@/services/activity";
import { clientsCacheKey, listClients } from "@/services/clients";
import { fetchCrmConfig, type CrmConfig } from "@/services/configuration";
import { actionLabel } from "@/lib/activity";
import type { Client } from "@/types";

const EMPTY_CLIENTS_KEY = clientsCacheKey({});

export default function DashboardPage() {
  const [tick, setTick] = useState(0);
  const [clients, setClients] = useState<Client[]>(
    () => cacheGet<Client[]>(EMPTY_CLIENTS_KEY) ?? []
  );
  const [config, setConfig] = useState<CrmConfig | null>(() => cacheGet<CrmConfig>("config:bundle"));
  const [activities, setActivities] = useState<ActivityLogRow[]>(
    () => cacheGet<ActivityLogRow[]>("activity::::::1:8") ?? []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener(DATA_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      setError("");
      try {
        const [rows, cfg, logs] = await Promise.all([
          listClients({}, ac.signal, { force: true }),
          fetchCrmConfig(ac.signal),
          fetchActivityLogs({ page_size: 8 }, ac.signal, { force: true }),
        ]);
        if (ac.signal.aborted) return;
        setClients(rows);
        setConfig(cfg);
        setActivities(logs);
      } catch (err) {
        if (ac.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
        setError(err instanceof ApiError ? err.message : "Failed to load dashboard");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [tick]);

  const stageData = useMemo(() => {
    const stages = config?.stages ?? [];
    return stages.map((stage) => ({
      name: stage.name,
      count: clients.filter((c) => c.stageId === stage.id).length,
    }));
  }, [clients, config]);

  const stats = [
    { label: "Total leads", value: clients.length },
    { label: "New leads", value: stageData[0]?.count ?? 0 },
    { label: "Qualified", value: stageData.find((s) => s.name === "Qualified")?.count ?? 0 },
    { label: "Won", value: stageData.find((s) => s.name === "Won")?.count ?? 0 },
  ];

  return (
    <div className="space-y-6 p-3 sm:p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl">Dashboard</h1>
        <p className="text-sm text-stone-500">Live analytics from the database</p>
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-stone-200 bg-white/80 p-4 dark:border-stone-800 dark:bg-stone-950/60"
          >
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
          {activities.map((a) => (
            <li
              key={a.id}
              className="flex justify-between gap-3 border-b border-stone-100 py-2 dark:border-stone-800"
            >
              <span>
                {actionLabel(a.action)}
                {a.client_name ? ` · ${a.client_name}` : ""}
              </span>
              <span className="text-stone-500">{formatDateTime(a.timestamp)}</span>
            </li>
          ))}
          {!loading && activities.length === 0 ? (
            <li className="py-4 text-stone-500">No activity yet. Create a lead to get started.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
