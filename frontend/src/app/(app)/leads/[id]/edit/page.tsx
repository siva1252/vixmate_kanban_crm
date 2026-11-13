"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getClient, updateClient } from "@/services/clients";
import { getSession } from "@/mock-services/auth";
import { useToast } from "@/components/toast";
import { ReasonDialog } from "@/components/reason-dialog";
import { ApiError } from "@/lib/api";
import type { Client } from "@/types";

export default function EditLeadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();
  const [existing, setExisting] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [deal, setDeal] = useState("");
  const [editing, setEditing] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    void getClient(params.id, ac.signal)
      .then((c) => {
        if (ac.signal.aborted) return;
        setExisting(c);
        setName(c.clientName);
        setPhone(c.primaryPhone);
        setDeal(String(c.estimatedDealValue ?? ""));
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        push(err instanceof ApiError ? err.message : "Lead not found", "error");
        setExisting(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [params.id, push]);

  if (loading) return <p className="p-6 text-stone-500">Loading…</p>;
  if (!existing) return <p className="p-6">Lead not found.</p>;

  const save = async () => {
    const session = getSession();
    if (!session) return;
    if (!editReason.trim()) {
      setReasonOpen(true);
      return;
    }
    const nextDeal = deal ? Number(deal) : undefined;
    setSaving(true);
    try {
      await updateClient(
        existing.id,
        {
          clientName: name,
          primaryPhone: phone.replace(/\D/g, "").slice(0, 15),
          estimatedDealValue: nextDeal,
        },
        editReason
      );
      push("Lead updated");
      router.push(`/leads/${existing.id}`);
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes("reason")) {
        setReasonOpen(true);
        return;
      }
      push(err instanceof ApiError ? err.message : "Update failed", "error");
    } finally {
      setSaving(false);
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
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 15))}
          />
        </div>
        <div>
          <Label>Estimated deal value</Label>
          <Input disabled={!editing} value={deal} onChange={(e) => setDeal(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <Button
              type="button"
              onClick={() => {
                setReasonOpen(true);
              }}
            >
              Edit
            </Button>
          ) : (
            <Button type="button" loading={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => router.push(`/leads/${existing.id}`)}>
            Cancel
          </Button>
        </div>
      </div>
      <ReasonDialog
        open={reasonOpen}
        title="Reason for edit"
        description="A reason is required before editing this lead."
        onClose={() => setReasonOpen(false)}
        onConfirm={(reason) => {
          setEditReason(reason);
          setEditing(true);
          setReasonOpen(false);
        }}
      />
    </div>
  );
}
