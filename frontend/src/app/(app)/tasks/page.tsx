"use client";

import { useState } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tasks as taskStore, TEAM, uid, pushActivity } from "@/mock-data/store";
import { getSession } from "@/mock-services/auth";
import { useToast } from "@/components/toast";

export default function TasksPage() {
  const [title, setTitle] = useState("");
  const [items, setItems] = useState(taskStore);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { push } = useToast();

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Tasks</h1>
      <div className="flex gap-2">
        <Input placeholder="New task title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button
          onClick={() => {
            const session = getSession();
            if (!session || !title.trim()) return;
            const task = {
              id: uid("tk"),
              clientId: "cl-1",
              title: title.trim(),
              description: "",
              assignedToId: session.teamMemberId,
              createdById: session.teamMemberId,
              priority: "medium" as const,
              status: "pending" as const,
            };
            taskStore.unshift(task);
            setItems([...taskStore]);
            setTitle("");
            push("Task created");
          }}
        >
          Add
        </Button>
      </div>
      <ul className="space-y-2">
        {items.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded-lg border bg-white/80 p-3 dark:border-stone-800 dark:bg-stone-950/60">
            <div>
              <p className="font-medium">{t.title}</p>
              <p className="text-xs text-stone-500">
                {t.status} · {TEAM.find((m) => m.id === t.assignedToId)?.displayName ?? "Unassigned"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  t.status = "completed";
                  setItems([...taskStore]);
                  push("Task completed");
                }}
              >
                Complete
              </Button>
              <Button size="sm" variant="danger" onClick={() => setDeleteId(t.id)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <ReasonDialog
        open={Boolean(deleteId)}
        title="Delete task"
        description="Task deletion requires a reason."
        onClose={() => setDeleteId(null)}
        onConfirm={(reason) => {
          const session = getSession();
          const idx = taskStore.findIndex((t) => t.id === deleteId);
          if (idx >= 0) {
            const [removed] = taskStore.splice(idx, 1);
            pushActivity({
              actorId: session?.teamMemberId,
              action: "task_deleted",
              entityType: "Task",
              entityId: removed.id,
              clientId: removed.clientId,
              reason,
            });
            setItems([...taskStore]);
            push("Task deleted");
          }
          setDeleteId(null);
        }}
      />
    </div>
  );
}
