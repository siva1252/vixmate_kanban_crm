"use client";

import { KanbanBoard } from "@/features/kanban/kanban-board";

export default function KanbanPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl">Kanban board</h1>
        <p className="text-sm text-stone-500">
          Drag cards across all eight stages. Won and Loss remain visible.
        </p>
      </div>
      <KanbanBoard />
    </div>
  );
}
