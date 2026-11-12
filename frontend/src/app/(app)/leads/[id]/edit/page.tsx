"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getClient, updateClient } from "@/mock-services/clients";
import { getSession } from "@/mock-services/auth";
import { useToast } from "@/components/toast";
import { ReasonDialog } from "@/components/reason-dialog";

export default function EditLeadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();
  const existing = getClient(params.id);
  const [name, setName] = useState(existing?.clientName ?? "");
  const [phone, setPhone] = useState(existing?.primaryPhone ?? "");
  const [deal, setDeal] = useState(String(existing?.estimatedDealValue ?? ""));
  const [editing, setEditing] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);

  if (!existing) return <p>Lead not found.</p>;

  const save = () => {
    const session = getSession();
    if (!session) return;
    if (!editReason.trim()) {
      setReasonOpen(true);
      return;
    }
    const nextDeal = deal ? Number(deal) : undefined;
    try {
      updateClient(
        existing.id,
        {
          clientName: name,
          primaryPhone: phone.replace(/\D/g, "").slice(0, 15),
          estimatedDealValue: nextDeal,
        },
        session.teamMemberId,
        editReason
      );
      push("Lead updated");
      router.push(`/leads/${existing.id}`);
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes("reason")) {
        setReasonOpen(true);
        return;
      }
      push(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 p-3 sm:p-4 md:p-6">
      <h1 className="font-display text-3xl">Edit lead</h1>
      <div className="space-y-3 rounded-xl border bg-white/80 p-5 dark:border-stone-800 dark:bg-stone-950/60">
        {!editing ? (
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Click Edit, enter a reason, then change fields and Save.
          </p>
        ) : (
          <p className="text-sm text-teal-800 dark:text-teal-200">Reason: {editReason}</p>
        )}
        <div>
          <Label>Client name</Label>
          <Input
            disabled={!editing}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9 .,&'\-]/g, "").slice(0, 80))}
          />
        </div>
        <div>
          <Label>Primary phone</Label>
          <Input
            disabled={!editing}
            maxLength={15}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 15))}
          />
        </div>
        <div>
          <Label>Estimated deal value</Label>
          <Input disabled={!editing} value={deal} onChange={(e) => setDeal(e.target.value)} />
        </div>
        {editing ? (
          <div className="flex gap-2">
            <Button onClick={save}>Save</Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(false);
                setEditReason("");
                setName(existing.clientName);
                setPhone(existing.primaryPhone);
                setDeal(String(existing.estimatedDealValue ?? ""));
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setReasonOpen(true)}>
            Edit
          </Button>
        )}
      </div>
      <ReasonDialog
        open={reasonOpen}
        title="Edit lead"
        description="Explain what you are changing before editing."
        onClose={() => setReasonOpen(false)}
        onConfirm={(reason) => {
          setEditReason(reason);
          setReasonOpen(false);
          setEditing(true);
        }}
      />
    </div>
  );
}
