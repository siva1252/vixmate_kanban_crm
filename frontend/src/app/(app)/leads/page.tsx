"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { LEAD_SOURCES, SERVICES, STAGES } from "@/mock-data/store";
import { listClients } from "@/mock-services/clients";

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [stageId, setStageId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [tick, setTick] = useState(0);

  const clients = useMemo(
    () =>
      listClients({
        search,
        stageId: stageId || undefined,
        sourceId: sourceId || undefined,
        serviceId: serviceId || undefined,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, stageId, sourceId, serviceId, tick]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Leads</h1>
          <p className="text-sm text-stone-500">Search and filter mock CRM clients</p>
        </div>
        <Link href="/leads/new" className="inline-flex h-10 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900">Create lead</Link>
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        <Input placeholder="Search name/phone/email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="h-10 rounded-md border px-3 text-sm" value={stageId} onChange={(e) => setStageId(e.target.value)}>
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className="h-10 rounded-md border px-3 text-sm" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">All sources</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className="h-10 rounded-md border px-3 text-sm" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">All services</option>
          {SERVICES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
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
                  <Link href={`/leads/${c.id}`} className="font-medium text-teal-900 underline dark:text-teal-300">
                    {c.clientName}
                  </Link>
                </td>
                <td className="px-3 py-2">{c.primaryPhone}</td>
                <td className="px-3 py-2">{STAGES.find((s) => s.id === c.stageId)?.name}</td>
                <td className="px-3 py-2">{c.firstCallCompleted ? "Yes" : "No"}</td>
              </tr>
            ))}
            {clients.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-stone-500">
                  No leads match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <button className="hidden" onClick={() => setTick((t) => t + 1)} />
    </div>
  );
}

