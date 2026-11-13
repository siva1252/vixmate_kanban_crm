"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITIES,
  actionLabel,
  actionNeedsReason,
  entityLabel,
  formatChangeSummary,
} from "@/lib/activity";
import { ApiError } from "@/lib/api";
import { cacheGet } from "@/lib/api-cache";
import { formatDateTime } from "@/lib/utils";
import { fetchActivityLogs, type ActivityLogRow } from "@/services/activity";
import { fetchTeamMembers } from "@/services/team";

export default function ActivityPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [rows, setRows] = useState<ActivityLogRow[]>(
    () => cacheGet<ActivityLogRow[]>("activity::::::1:100") ?? []
  );
  const [team, setTeam] = useState<Array<{ id: string; userId?: string; displayName: string }>>(
    () => cacheGet("team:list") ?? []
  );
  const [loading, setLoading] = useState(() => !cacheGet("activity::::::1:100"));
  const [error, setError] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const ac = new AbortController();
    void fetchTeamMembers(ac.signal)
      .then((members) => setTeam(members))
      .catch(() => setTeam([]));
    return () => ac.abort();
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    setError("");
    try {
      const data = await fetchActivityLogs(
        {
          search: debouncedSearch || undefined,
          team_member: actorId || undefined,
          action: action || undefined,
          entity_type: entityType || undefined,
          page_size: 100,
        },
        signal
      );
      if (signal?.aborted) return;
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
      setError(err instanceof ApiError ? err.message : "Failed to load logs");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [debouncedSearch, actorId, action, entityType]);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const actionOptions = useMemo(() => {
    const known = new Map<string, string>(ACTIVITY_ACTIONS.map((a) => [a.value, a.label]));
    for (const row of rows) {
      if (!known.has(row.action)) known.set(row.action, actionLabel(row.action));
    }
    return [...known.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const entityOptions = useMemo(() => {
    const known = new Map<string, string>(ACTIVITY_ENTITIES.map((e) => [e.value, e.label]));
    for (const row of rows) {
      if (!known.has(row.entity_type)) known.set(row.entity_type, entityLabel(row.entity_type));
    }
    return [...known.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl">Active Logs</h1>
          <p className="text-sm text-stone-500">
            Live audit trail from the database — logins, lead changes, Lead Source, working, and more.
          </p>
        </div>
        <p className="text-sm font-medium text-stone-700 dark:text-stone-200">
          {loading && rows.length === 0
            ? "Loading…"
            : `${rows.length} log${rows.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search logs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900"
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
        >
          <option value="">All people</option>
          {team
            .filter((t) => t.userId)
            .map((t) => (
              <option key={t.id} value={t.userId}>
                {t.displayName}
              </option>
            ))}
        </select>
        <select
          className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        >
          <option value="">All actions</option>
          {actionOptions.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        >
          <option value="">All entities</option>
          {entityOptions.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <div className="overflow-auto rounded-xl border border-stone-200 bg-white/80 dark:border-stone-800 dark:bg-stone-950/60">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-stone-100 text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Lead</th>
              <th className="px-3 py-2">What changed</th>
              <th className="px-3 py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const showReason = actionNeedsReason(a.action);
              const changes = formatChangeSummary(
                (a.old_values as Record<string, unknown>) || undefined,
                (a.new_values as Record<string, unknown>) || undefined,
                a.action
              );
              return (
                <tr key={a.id} className="border-t align-top dark:border-stone-800">
                  <td className="whitespace-nowrap px-3 py-2">{formatDateTime(a.timestamp)}</td>
                  <td className="px-3 py-2">{a.actor_name || "—"}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{actionLabel(a.action)}</p>
                    {a.description ? (
                      <p className="text-xs text-stone-500">{a.description}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{entityLabel(a.entity_type)}</p>
                  </td>
                  <td className="px-3 py-2">{a.client_name || "—"}</td>
                  <td className="max-w-sm px-3 py-2 text-xs text-stone-600 dark:text-stone-300">
                    {changes.length > 0 ? (
                      <ul className="space-y-0.5">
                        {changes.map((line) => (
                          <li key={line}>• {line}</li>
                        ))}
                      </ul>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-[14rem] px-3 py-2 text-xs">
                    {showReason || a.reason ? a.reason || "—" : "—"}
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-stone-500">
                  No logs match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
