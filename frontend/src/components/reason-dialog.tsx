"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

export function ReasonDialog({ open, title, description, busy = false, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      danger
      busy={busy}
      confirmLabel="Confirm with reason"
      onClose={() => {
        if (busy) return;
        setReason("");
        setError("");
        onClose();
      }}
      onConfirm={() => {
        if (busy) return;
        if (reason.trim().length < 3) {
          setError("Reason must be at least 3 characters.");
          return;
        }
        onConfirm(reason.trim());
        setReason("");
        setError("");
      }}
    >
      <Label htmlFor="reason">Reason</Label>
      <Textarea
        id="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Explain why this change is needed"
        disabled={busy}
      />
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
    </Dialog>
  );
}
