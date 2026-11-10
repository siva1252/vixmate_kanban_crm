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
  const [reasonOpen, setReasonOpen] = useState(false);

  if (!existing) return <p>Lead not found.</p>;

  const save = (reason?: string) => {
    const session = getSession();
    if (!session) return;
    const nextDeal = deal ? Number(deal) : undefined;
    try {
      updateClient(
        existing.id,
        {
          clientName: name,
          primaryPhone: phone,
          estimatedDealValue: nextDeal,
        },
        session.teamMemberId,
        reason
      );
      push("Lead updated");
      router.push(`/leads/${existing.id}`);
    } catch (err) {
      if (err instanceof Error && err.message.includes("reason")) {
        setReasonOpen(true);
        return;
      }
      push(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="font-display text-3xl">Edit lead</h1>
      <div className="space-y-3 rounded-xl border bg-white/80 p-5 dark:border-stone-800 dark:bg-stone-950/60">
        <div>
          <Label>Client name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Primary phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label>Estimated deal value</Label>
          <Input value={deal} onChange={(e) => setDeal(e.target.value)} />
        </div>
        <Button onClick={() => save()}>Save changes</Button>
      </div>
      <ReasonDialog
        open={reasonOpen}
        title="Deal value change"
        onClose={() => setReasonOpen(false)}
        onConfirm={(reason) => {
          setReasonOpen(false);
          save(reason);
        }}
      />
    </div>
  );
}
