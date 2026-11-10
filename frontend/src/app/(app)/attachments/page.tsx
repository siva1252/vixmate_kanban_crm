"use client";

import { useState } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import { Button } from "@/components/ui/button";
import { attachments as attachmentStore, pushActivity, uid } from "@/mock-data/store";
import { getSession } from "@/mock-services/auth";
import { useToast } from "@/components/toast";

export default function AttachmentsPage() {
  const [items, setItems] = useState(attachmentStore);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { push } = useToast();

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Attachments</h1>
      <Button
        onClick={() => {
          const session = getSession();
          if (!session) return;
          attachmentStore.unshift({
            id: uid("at"),
            clientId: "cl-1",
            originalFilename: `note-${Date.now()}.txt`,
            fileType: "text/plain",
            fileSize: 1024,
            uploadedById: session.teamMemberId,
            uploadedAt: new Date().toISOString(),
          });
          setItems([...attachmentStore]);
          push("Attachment uploaded (mock metadata)");
        }}
      >
        Upload mock file
      </Button>
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">{a.originalFilename}</p>
              <p className="text-xs text-stone-500">{(a.fileSize / 1024).toFixed(1)} KB</p>
            </div>
            <Button size="sm" variant="danger" onClick={() => setDeleteId(a.id)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
      <ReasonDialog
        open={Boolean(deleteId)}
        title="Delete attachment"
        onClose={() => setDeleteId(null)}
        onConfirm={(reason) => {
          const session = getSession();
          const idx = attachmentStore.findIndex((a) => a.id === deleteId);
          if (idx >= 0) {
            const [removed] = attachmentStore.splice(idx, 1);
            pushActivity({
              actorId: session?.teamMemberId,
              action: "attachment_deleted",
              entityType: "Attachment",
              entityId: removed.id,
              clientId: removed.clientId,
              reason,
            });
            setItems([...attachmentStore]);
            push("Attachment deleted");
          }
          setDeleteId(null);
        }}
      />
    </div>
  );
}
