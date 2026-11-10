"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import Link from "next/link";
import { getSession } from "@/mock-services/auth";
import { getKanbanBoard, moveCard } from "@/mock-services/kanban";
import { TEAM } from "@/mock-data/store";
import { useToast } from "@/components/toast";
import type { Client } from "@/types";
import { formatDate } from "@/lib/utils";

function Card({ client }: { client: Client }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: client.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  const assignees = TEAM.filter(() => true); // visual only; assignments resolved elsewhere

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-lg border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-700 dark:bg-stone-900 ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <Link href={`/leads/${client.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
        {client.clientName}
      </Link>
      <p className="mt-1 text-xs text-stone-500">{client.primaryPhone}</p>
      <p className="mt-2 text-[11px] text-stone-400">
        Created {formatDate(client.createdAt)} · Updated {formatDate(client.updatedAt)}
      </p>
      <p className="mt-1 text-[11px] text-stone-500">
        Team: {assignees.slice(0, 2).map((t) => t.displayName).join(", ")}
      </p>
    </div>
  );
}

function Column({
  id,
  title,
  cards,
}: {
  id: string;
  title: string;
  cards: Client[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-xl border p-3 ${
        isOver
          ? "border-teal-700 bg-teal-50/70 dark:bg-teal-950/30"
          : "border-stone-200 bg-stone-50/80 dark:border-stone-800 dark:bg-stone-950/40"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-stone-500">{cards.length}</span>
      </div>
      <div className="space-y-2">
        {cards.map((card) => (
          <Card key={card.id} client={card} />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard() {
  const [tick, setTick] = useState(0);
  const { push } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const board = useMemo(() => getKanbanBoard(), [tick]);

  const onDragEnd = (event: DragEndEvent) => {
    const clientId = String(event.active.id);
    const stageId = event.over ? String(event.over.id) : null;
    if (!stageId) return;
    const session = getSession();
    if (!session) return;
    try {
      moveCard(clientId, stageId, session.teamMemberId);
      setTick((t) => t + 1);
      push("Stage updated");
    } catch (err) {
      push(err instanceof Error ? err.message : "Move failed", "error");
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {board.map((column) => (
          <Column
            key={column.stage.id}
            id={column.stage.id}
            title={column.stage.name}
            cards={column.cards}
          />
        ))}
      </div>
    </DndContext>
  );
}
