"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { cacheGet } from "@/lib/api-cache";
import { listClients } from "@/services/clients";
import { fetchCrmConfig, type CrmConfig } from "@/services/configuration";
import type { Client } from "@/types";

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stageId, setStageId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [clients, setClients] = useState<Client[]>(
    () => cacheGet<Client[]>("clients::::::::") ?? []
  );
  const [config, setConfig] = useState<CrmConfig | null>(() => cacheGet<CrmConfig>("config:bundle"));
  const [loading, setLoading] = useState(() => !cacheGet("clients::::::::"));
  const [error, setError] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const ac = new AbortController();
    void fetchCrmConfig(ac.signal)
      .then((c) => {
        if (!ac.signal.aborted) setConfig(c);
      })
      .catch(() => {
        if (!ac.signal.aborted) setConfig(null);
      });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      setLoading(clients.length === 0);
      setError("");
      try {
        const rows = await listClients(
          {
            search: debouncedSearch || undefined,
            stageId: stageId || undefined,
            sourceId: sourceId || undefined,
            serviceId: serviceId || undefined,
          },
          ac.signal
        );
        if (!ac.signal.aborted) setClients(rows);
      } catch (err) {
        if (ac.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
        setError(err instanceof ApiError ? err.message : "Failed to load leads");
        setClients([]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, stageId, sourceId, serviceId]);

  const stageName = useMemo(() => {
    const map = new Map((config?.stages ?? []).map((s) => [s.id, s.name]));
    return (id: string) => map.get(id) ?? "—";
  }, [config]);

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Leads</h1>
          <p className="text-sm text-stone-500">Live leads from the database</p>
        </div>
        <Link
          href="/leads/new"
          className="inline-flex h-10 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900"
        >
          Create lead
        </Link>
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        <Input
          placeholder="Search name/phone/email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-10 rounded-md border px-3 text-sm"
          value={stageId}
          onChange={(e) => setStageId(e.target.value)}
        >
          <option value="">All stages</option>
          {(config?.stages ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border px-3 text-sm"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
        >
          <option value="">All sources</option>
          {(config?.leadSources ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border px-3 text-sm"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
        >
          <option value="">All services</option>
          {(config?.services ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <div className="overflow-hidden rounded-xl border bg-white/80 dark:border-stone-800 dark:bg-stone-950/60">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-100 text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">First call</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-t dark:border-stone-800">
                <td className="px-3 py-2">
                  <Link
                    href={`/leads/${c.id}`}
                    className="font-medium text-teal-900 underline dark:text-teal-300"
                  >
                    {c.clientName}
                  </Link>
                </td>
                <td className="px-3 py-2">{c.primaryPhone}</td>
                <td className="px-3 py-2">{stageName(c.stageId)}</td>
                <td className="px-3 py-2">{c.firstCallCompleted ? "Yes" : "No"}</td>
              </tr>
            ))}
            {!loading && clients.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-stone-500">
                  No leads match these filters.
                </td>
              </tr>
            ) : null}
            {loading && clients.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-stone-500">
                  Loading…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
