"use client";

import { useMemo, useState } from "react";
import { GripVertical, Pencil, Trash2, X } from "lucide-react";
import { ReasonDialog } from "@/components/reason-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { getSession } from "@/mock-services/auth";
import {
  COLUMN_COLORS,
  addStage,
  deleteStage,
  reorderStages,
  sortedStages,
  updateStage,
} from "@/mock-data/store";
import { cn } from "@/lib/utils";
import type { LeadStage } from "@/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
};

export function ColumnsSettings({ open, onClose, onChanged }: Props) {
  const { push } = useToast();
  const [tick, setTick] = useState(0);
  const stages = useMemo(() => sortedStages(), [tick, open]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(COLUMN_COLORS[1]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>(COLUMN_COLORS[0]);
  const [deleteTarget, setDeleteTarget] = useState<LeadStage | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  if (!open) return null;

  const refresh = () => {
    setTick((t) => t + 1);
    onChanged();
  };

  const startEdit = (stage: LeadStage) => {
    setEditId(stage.id);
    setEditName(stage.name);
    setEditColor(stage.color ?? COLUMN_COLORS[0]);
  };

  const saveEdit = () => {
    const session = getSession();
    if (!session || !editId) return;
    try {
      updateStage(editId, { name: editName, color: editColor }, session.teamMemberId);
      setEditId(null);
      refresh();
      push("Column updated");
    } catch (err) {
      push(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  const addColumn = () => {
    const session = getSession();
    if (!session) return;
    try {
      addStage(newName, newColor, session.teamMemberId);
      setNewName("");
      setNewColor(COLUMN_COLORS[1]);
      refresh();
      push("Column added");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not add column", "error");
    }
  };

  const onDropReorder = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const session = getSession();
    if (!session) return;
    const ids = stages.map((s) => s.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) {
      setDragId(null);
      return;
    }
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    try {
      reorderStages(ids, session.teamMemberId);
      refresh();
      push("Columns reordered");
    } catch (err) {
      push(err instanceof Error ? err.message : "Reorder failed", "error");
    }
    setDragId(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/40">
        <button type="button" className="absolute inset-0" aria-label="Close columns panel" onClick={onClose} />
        <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-stone-200 bg-white shadow-2xl dark:border-stone-800 dark:bg-stone-950">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-800">
            <div>
              <h2 className="font-display text-xl">Board columns</h2>
              <p className="text-xs text-stone-500">Add, edit, reorder, or delete columns</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Rename columns, drag to reorder, and pick a color for each.
            </p>

            <ul className="space-y-2">
              {stages.map((stage) => {
                const editing = editId === stage.id;
                return (
                  <li
                    key={stage.id}
                    draggable={!editing}
                    onDragStart={() => setDragId(stage.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDropReorder(stage.id)}
                    className={cn(
                      "rounded-xl border border-stone-200 bg-stone-50/80 p-3 dark:border-stone-800 dark:bg-stone-900/50",
                      dragId === stage.id && "opacity-60 ring-2 ring-teal-700"
                    )}
                  >
                    {editing ? (
                      <div className="space-y-3">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Column name"
                        />
                        <div className="flex flex-wrap gap-2">
                          {COLUMN_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              aria-label={`Color ${c}`}
                              onClick={() => setEditColor(c)}
                              className={cn(
                                "h-6 w-6 rounded-full ring-offset-2",
                                editColor === c && "ring-2 ring-stone-900 dark:ring-stone-100"
                              )}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-stone-400" />
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: stage.color ?? COLUMN_COLORS[0] }}
                          />
                          <p className="min-w-0 flex-1 truncate text-sm font-medium">{stage.name}</p>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(stage)} aria-label="Edit column">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteTarget(stage)}
                            aria-label="Delete column"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-rose-700" />
                          </Button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
                          {COLUMN_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              aria-label={`Set color ${c}`}
                              onClick={() => {
                                const session = getSession();
                                if (!session) return;
                                try {
                                  updateStage(stage.id, { color: c }, session.teamMemberId);
                                  refresh();
                                } catch (err) {
                                  push(err instanceof Error ? err.message : "Update failed", "error");
                                }
                              }}
                              className={cn(
                                "h-5 w-5 rounded-full",
                                (stage.color ?? "") === c && "ring-2 ring-stone-900 ring-offset-1 dark:ring-stone-100"
                              )}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="space-y-3 rounded-xl border border-dashed border-stone-300 p-3 dark:border-stone-700">
              <Input
                placeholder="New column name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {COLUMN_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`New color ${c}`}
                    onClick={() => setNewColor(c)}
                    className={cn(
                      "h-6 w-6 rounded-full ring-offset-2",
                      newColor === c && "ring-2 ring-stone-900 dark:ring-stone-100"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={addColumn}>
                  Add column
                </Button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <ReasonDialog
        open={Boolean(deleteTarget)}
        title="Delete column"
        description="A reason is required. Leads in this column move to the first remaining column."
        onClose={() => setDeleteTarget(null)}
        onConfirm={(reason) => {
          if (!deleteTarget) return;
          const session = getSession();
          if (!session) return;
          try {
            deleteStage(deleteTarget.id, session.teamMemberId, reason);
            setDeleteTarget(null);
            refresh();
            push("Column deleted");
          } catch (err) {
            push(err instanceof Error ? err.message : "Delete failed", "error");
          }
        }}
      />
    </>
  );
}
