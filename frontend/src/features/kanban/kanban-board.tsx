"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import Image from "next/image";
import Link from "next/link";
import { Columns3, Filter, Plus, Search, Settings2, Table2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColumnsSettings } from "@/features/kanban/columns-settings";
import { ApiError } from "@/lib/api";
import { cacheGet } from "@/lib/api-cache";
import { DATA_CHANGED_EVENT } from "@/lib/data-events";
import { cn, formatDate } from "@/lib/utils";
import { fetchCrmConfig, type CrmConfig } from "@/services/configuration";
import { fetchKanbanBoard, moveCard, type KanbanColumn } from "@/services/kanban";
import type { Client } from "@/types";

function Card({
  client,
  serviceName,
  sourceName,
}: {
  client: Client;
  serviceName?: string;
  sourceName?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: client.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-700 dark:bg-stone-900",
        isDragging && "opacity-60 ring-2 ring-teal-700"
      )}
    >
      <div className="mb-2">
        <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
          {serviceName ?? "Lead"}
        </span>
      </div>
      <Link
        href={`/leads/${client.id}`}
        className="block text-sm font-semibold hover:underline"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {client.clientName}
      </Link>
      <p className="mt-1 line-clamp-2 text-xs text-stone-500">
        {client.primaryEmail
          ? client.primaryEmail
          : sourceName
            ? `Lead via ${sourceName}`
            : "No email on file"}
      </p>
      <p className="mt-2 text-[11px] text-stone-400">Updated {formatDate(client.updatedAt)}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative inline-flex h-6 w-6 shrink-0 overflow-hidden rounded-md bg-black ring-1 ring-stone-900/10">
            <Image
              src="/brand/viximate-logo.png"
              alt="Viximate"
              width={24}
              height={24}
              className="h-full w-full object-cover"
            />
          </span>
          <span className="truncate text-xs text-stone-600 dark:text-stone-300">
            {client.primaryPhone}
          </span>
        </div>
      </div>
    </div>
  );
}

function Column({
  id,
  title,
  color,
  cards,
  config,
}: {
  id: string;
  title: string;
  color?: string;
  cards: Client[];
  config: CrmConfig | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full w-[280px] shrink-0 flex-col rounded-2xl border",
        isOver
          ? "border-teal-700 bg-teal-50/70 dark:bg-teal-950/30"
          : "border-stone-200 bg-stone-100/70 dark:border-stone-800 dark:bg-stone-950/50"
      )}
    >
      <div className="h-1.5 shrink-0 rounded-t-2xl" style={{ backgroundColor: color ?? "#0f766e" }} />
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color ?? "#0f766e" }}
          />
          <h3 className="truncate text-sm font-semibold">{title}</h3>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-stone-600 dark:bg-stone-900 dark:text-stone-300">
          {cards.length}
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
        {cards.length === 0 ? (
          <div className="grid h-24 place-items-center rounded-xl border border-dashed border-stone-300 text-xs text-stone-400 dark:border-stone-700">
            Drop cards here
          </div>
        ) : (
          cards.map((card) => (
            <Card
              key={card.id}
              client={card}
              serviceName={config?.services.find((s) => s.id === card.serviceId)?.name}
              sourceName={config?.leadSources.find((s) => s.id === card.leadSourceId)?.name}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function KanbanBoard() {
  const [tick, setTick] = useState(0);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [board, setBoard] = useState<KanbanColumn[]>(
    () => cacheGet<KanbanColumn[]>("kanban:board::::") ?? []
  );
  const [config, setConfig] = useState<CrmConfig | null>(() => cacheGet<CrmConfig>("config:bundle"));
  const [loading, setLoading] = useState(() => !cacheGet("kanban:board::::"));
  const { push } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener(DATA_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void fetchCrmConfig(ac.signal)
      .then((c) => {
        if (!ac.signal.aborted) setConfig(c);
      })
      .catch(() => undefined);
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      const emptyBoard = board.length === 0;
      if (emptyBoard) setLoading(true);
      try {
        const rows = await fetchKanbanBoard(
          {
            search: debouncedSearch || undefined,
            sourceId: sourceId || undefined,
            serviceId: serviceId || undefined,
          },
          ac.signal,
          { force: true }
        );
        if (!ac.signal.aborted) setBoard(rows);
      } catch (err) {
        if (ac.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
        push(err instanceof ApiError ? err.message : "Failed to load board", "error");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sourceId, serviceId, tick, push]);

  const flatCards = useMemo(() => board.flatMap((c) => c.cards), [board]);

  const onDragEnd = (event: DragEndEvent) => {
    const id = String(event.active.id);
    const nextStageId = event.over ? String(event.over.id) : null;
    if (!nextStageId) return;
    const current = flatCards.find((c) => c.id === id);
    if (current?.stageId === nextStageId) return;
    void (async () => {
      try {
        await moveCard(id, nextStageId);
        setTick((t) => t + 1);
        push("Stage updated");
      } catch (err) {
        push(err instanceof ApiError ? err.message : "Move failed", "error");
      }
    })();
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
        <p>
          Home <span className="mx-1">/</span> Boards
        </p>
        {loading && board.length === 0 ? <p>Loading board…</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-stone-200 bg-white p-1 dark:border-stone-700 dark:bg-stone-900">
          <button
            type="button"
            onClick={() => setView("kanban")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
              view === "kanban"
                ? "bg-teal-900 text-white"
                : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
            )}
          >
            <Columns3 className="h-3.5 w-3.5" />
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
              view === "table"
                ? "bg-teal-900 text-white"
                : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
            )}
          >
            <Table2 className="h-3.5 w-3.5" />
            Table
          </button>
        </div>

        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input
            className="pl-9"
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)}>
          <Filter className="h-4 w-4" />
          Filters
        </Button>

        <Button variant="outline" size="sm" onClick={() => setColumnsOpen(true)}>
          <Settings2 className="h-4 w-4" />
          Columns
        </Button>

        <Link
          href="/leads/new"
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md bg-teal-800 px-3 text-sm font-medium text-white hover:bg-teal-900"
        >
          <Plus className="h-4 w-4" />
          New lead
        </Link>
      </div>

      {showFilters ? (
        <div className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto rounded-xl border border-stone-200 bg-white/80 p-2 dark:border-stone-800 dark:bg-stone-950/50">
          <select
            className="h-10 min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2 text-sm dark:border-stone-700 dark:bg-stone-900"
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
            className="h-10 min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2 text-sm dark:border-stone-700 dark:bg-stone-900"
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
      ) : null}

      {view === "kanban" ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden pb-2">
            <div className="flex h-full min-h-[28rem] gap-3 pr-2">
              {board.map((column) => (
                <Column
                  key={column.stage.id}
                  id={column.stage.id}
                  title={column.stage.name}
                  color={column.stage.color}
                  cards={column.cards}
                  config={config}
                />
              ))}
            </div>
          </div>
        </DndContext>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-stone-200 bg-white/80 dark:border-stone-800 dark:bg-stone-950/60">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="sticky top-0 bg-stone-100 text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
              <tr>
                <th className="px-3 py-2">Lead</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Service</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {flatCards.map((c) => (
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
                  <td className="px-3 py-2">
                    {board.find((col) => col.stage.id === c.stageId)?.stage.name ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {config?.services.find((s) => s.id === c.serviceId)?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2">{formatDate(c.updatedAt)}</td>
                </tr>
              ))}
              {!loading && flatCards.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-stone-500">
                    No leads match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <ColumnsSettings
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        onChanged={() => setTick((t) => t + 1)}
      />
    </div>
  );
}
