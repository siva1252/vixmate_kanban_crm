"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  attachments as attachmentStore,
  clients,
  pushActivity,
  TEAM,
  uid,
} from "@/mock-data/store";
import { getSession } from "@/mock-services/auth";
import { useToast } from "@/components/toast";
import {
  ATTACHMENT_ACCEPT,
  DOCUMENT_TYPES,
  documentTypeLabel,
  downloadAttachmentFile,
  openAttachmentFile,
  readFileAsDataUrl,
  validateAttachmentFile,
} from "@/lib/attachments";
import { formatDateTime } from "@/lib/utils";
import type { AttachmentDocumentType, AttachmentRecord } from "@/types";

export default function AttachmentsPage() {
  const [items, setItems] = useState(attachmentStore);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editReasonOpen, setEditReasonOpen] = useState(false);
  const [clientFilter, setClientFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [clientId, setClientId] = useState("");
  const [documentType, setDocumentType] = useState<AttachmentDocumentType>("proposal");
  const [documentTypeOther, setDocumentTypeOther] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  const visible = useMemo(
    () =>
      items.filter((a) => {
        if (clientFilter && a.clientId !== clientFilter) return false;
        if (typeFilter && a.documentType !== typeFilter) return false;
        return true;
      }),
    [items, clientFilter, typeFilter]
  );

  const resetForm = () => {
    setEditId(null);
    setClientId("");
    setDocumentType("proposal");
    setDocumentTypeOther("");
    setTitle("");
    setDescription("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const startEdit = (a: AttachmentRecord) => {
    setShowForm(true);
    setEditId(a.id);
    setClientId(a.clientId);
    setDocumentType(a.documentType);
    setDocumentTypeOther(a.documentTypeOther ?? "");
    setTitle(a.title);
    setDescription(a.description ?? "");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const validateForm = () => {
    if (!clientId) {
      push("Choose the lead this file belongs to", "error");
      return false;
    }
    if (!title.trim()) {
      push("Enter a document name", "error");
      return false;
    }
    if (documentType === "other" && !documentTypeOther.trim()) {
      push("Please briefly explain what this other document is", "error");
      return false;
    }
    if (file) {
      const fileError = validateAttachmentFile(file);
      if (fileError) {
        push(fileError, "error");
        return false;
      }
    }
    return true;
  };

  const applyUpdate = async (reason: string) => {
    const session = getSession();
    if (!session || !editId) return;
    const idx = attachmentStore.findIndex((a) => a.id === editId);
    if (idx < 0) return;
    const current = attachmentStore[idx];
    let fileDataUrl = current.fileDataUrl;
    let originalFilename = current.originalFilename;
    let fileType = current.fileType;
    let fileSize = current.fileSize;
    if (file) {
      fileDataUrl = await readFileAsDataUrl(file);
      originalFilename = file.name;
      fileType = file.type || "application/octet-stream";
      fileSize = file.size;
    }
    attachmentStore[idx] = {
      ...current,
      clientId,
      documentType,
      documentTypeOther: documentType === "other" ? documentTypeOther.trim() : undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      originalFilename,
      fileType,
      fileSize,
      fileDataUrl,
    };
    pushActivity({
      actorId: session.teamMemberId,
      action: "attachment_updated",
      entityType: "Attachment",
      entityId: editId,
      clientId,
      reason,
      newValues: { title: title.trim(), documentType },
    });
    setItems([...attachmentStore]);
    setEditReasonOpen(false);
    setShowForm(false);
    resetForm();
    push("Attachment updated");
  };

  const save = async () => {
    const session = getSession();
    if (!session) return;
    if (!validateForm()) return;

    if (editId) {
      setEditReasonOpen(true);
      return;
    }

    if (!file) {
      push("Upload a file (PDF, DOC, or DOCX, under 5 MB)", "error");
      return;
    }
    const fileDataUrl = await readFileAsDataUrl(file);

    attachmentStore.unshift({
      id: uid("at"),
      clientId,
      originalFilename: file.name,
      documentType,
      documentTypeOther: documentType === "other" ? documentTypeOther.trim() : undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      uploadedById: session.teamMemberId,
      uploadedAt: new Date().toISOString(),
      fileDataUrl,
    });
    pushActivity({
      actorId: session.teamMemberId,
      action: "attachment_uploaded",
      entityType: "Attachment",
      entityId: attachmentStore[0].id,
      clientId,
      newValues: { title: title.trim(), documentType, filename: file.name },
    });
    setItems([...attachmentStore]);
    setShowForm(false);
    resetForm();
    push("Attachment linked to lead");
  };

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      <div className="max-w-3xl space-y-2">
        <h1 className="font-display text-2xl sm:text-3xl">Attachments</h1>
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Attach client documents to a lead. Open any row to jump into that lead’s docs.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-10 min-w-[12rem] rounded-md border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900"
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
        >
          <option value="">All leads</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.clientName}
            </option>
          ))}
        </select>
        <select
          className="h-10 min-w-[10rem] rounded-md border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All document types</option>
          {DOCUMENT_TYPES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <Button
          className="ml-auto"
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              resetForm();
              return;
            }
            resetForm();
            setShowForm(true);
            if (clientFilter) setClientId(clientFilter);
          }}
        >
          {showForm ? "Close form" : "Attach to lead"}
        </Button>
      </div>

      {showForm ? (
        <div className="max-w-2xl space-y-3 rounded-xl border border-stone-200 bg-white/80 p-4 dark:border-stone-800 dark:bg-stone-950/50">
          <h2 className="font-medium">{editId ? "Edit attachment" : "New attachment"}</h2>
          <div>
            <Label htmlFor="attach-lead">Lead / client</Label>
            <select
              id="attach-lead"
              className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Select lead…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.clientName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="attach-type">Document type</Label>
            <select
              id="attach-type"
              className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900"
              value={documentType}
              onChange={(e) => {
                const next = e.target.value as AttachmentDocumentType;
                setDocumentType(next);
                if (next !== "other") setDocumentTypeOther("");
              }}
            >
              {DOCUMENT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          {documentType === "other" ? (
            <div>
              <Label htmlFor="attach-type-other">Please describe this other document</Label>
              <Input
                id="attach-type-other"
                placeholder="Briefly explain what this file is"
                value={documentTypeOther}
                onChange={(e) => setDocumentTypeOther(e.target.value)}
              />
            </div>
          ) : null}
          <div>
            <Label htmlFor="attach-title">Document name</Label>
            <Input
              id="attach-title"
              placeholder="e.g. Q1 pricing proposal"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="attach-desc">Notes (optional)</Label>
            <Textarea
              id="attach-desc"
              placeholder="Short context for the team"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="attach-file">{editId ? "Replace file (optional)" : "Upload file here"}</Label>
            <Input
              id="attach-file"
              ref={fileRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                if (!next) {
                  setFile(null);
                  return;
                }
                const error = validateAttachmentFile(next);
                if (error) {
                  push(error, "error");
                  e.target.value = "";
                  setFile(null);
                  return;
                }
                setFile(next);
                if (!title.trim()) setTitle(next.name.replace(/\.[^.]+$/, ""));
              }}
            />
            <p className="mt-1.5 text-xs text-stone-500">Allowed: PDF, DOC, DOCX · Max size: 5 MB</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void save()}>{editId ? "Update attachment" : "Save attachment"}</Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="space-y-2">
        {visible.map((a) => {
          const lead = clients.find((c) => c.id === a.clientId);
          const typeLabel =
            a.documentType === "other" && a.documentTypeOther
              ? `Other · ${a.documentTypeOther}`
              : documentTypeLabel(a.documentType);
          return (
            <li
              key={a.id}
              className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-stone-800 dark:bg-stone-950/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{lead?.clientName ?? "Unknown client"}</p>
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                    {typeLabel}
                  </span>
                </div>
                <p className="mt-1 text-sm text-stone-700 dark:text-stone-200">
                  Document name: {a.title}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {a.originalFilename} · {(a.fileSize / 1024).toFixed(1)} KB · uploaded by{" "}
                  {TEAM.find((t) => t.id === a.uploadedById)?.displayName ?? "—"} ·{" "}
                  {formatDateTime(a.uploadedAt)}
                </p>
                {a.description ? (
                  <p className="mt-1 line-clamp-1 text-xs text-stone-500">{a.description}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="text-xs font-medium text-teal-800 hover:underline dark:text-teal-300"
                    onClick={() => {
                      if (!openAttachmentFile(a.fileDataUrl, a.fileType)) {
                        push("Re-upload this file to enable Open (mock files need content).", "error");
                      }
                    }}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-teal-800 hover:underline dark:text-teal-300"
                    onClick={() => {
                      if (!downloadAttachmentFile(a.fileDataUrl, a.originalFilename, a.fileType)) {
                        push("Re-upload this file to enable Download (mock files need content).", "error");
                      }
                    }}
                  >
                    Download
                  </button>
                  <Link
                    href={`/leads/${a.clientId}?tab=Docs`}
                    className="text-xs font-medium text-teal-800 hover:underline dark:text-teal-300"
                  >
                    Open lead docs →
                  </Link>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(a)}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => setDeleteId(a.id)}>
                  Delete
                </Button>
              </div>
            </li>
          );
        })}
        {visible.length === 0 ? (
          <li className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 dark:border-stone-700">
            No attachments yet for this filter.
          </li>
        ) : null}
      </ul>

      <ReasonDialog
        open={editReasonOpen}
        title="Update attachment"
        description="A reason is required when editing a document."
        onClose={() => setEditReasonOpen(false)}
        onConfirm={(reason) => {
          void applyUpdate(reason);
        }}
      />
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
