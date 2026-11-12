"use client";

import { KanbanBoard } from "@/features/kanban/kanban-board";

export default function BoardsPage() {
  return (
    <div className="flex h-full min-h-0 flex-col p-3 sm:p-4 md:p-6">
      <div className="mb-3 shrink-0 sm:mb-4">
        <h1 className="font-display text-2xl sm:text-3xl">Boards</h1>
        <p className="text-sm text-stone-500">
          Pipeline board — drag leads across stages. Won and Loss stay visible.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <KanbanBoard />
      </div>
    </div>
  );
}
