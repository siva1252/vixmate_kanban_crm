"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Trash2 } from "lucide-react";
import { ReasonDialog } from "@/components/reason-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LEAD_SOURCES,
  SERVICES,
  STAGES,
  TEAM,
  attachments,
  comments,
  followups,
  activities,
  working,
  peopleForClient,
  pushActivity,
  uid,
} from "@/mock-data/store";
import { deleteClient, getClient, updateClient } from "@/mock-services/clients";
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
import { actionLabel, entityLabel, formatChangeSummary } from "@/lib/activity";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import type { AttachmentDocumentType, Client, LeadWorking } from "@/types";

type TabId = "Details" | "Comments" | "History" | "Follow-ups" | "Docs" | "Working";

const NAME_MAX = 80;
const PHONE_MAX = 15;
const EMAIL_MAX = 120;

function resolveTab(raw: string | null): TabId {
  if (!raw) return "Details";
  if (raw === "Overview") return "Details";
  if (raw === "Activity") return "History";
  if (raw === "Followups") return "Follow-ups";
  if (raw === "Files" || raw === "attachments" || raw === "files") return "Docs";
  if (raw === "Working" || raw === "working" || raw === "Assigned") return "Working";
  return (["Details", "Comments", "History", "Follow-ups", "Docs", "Working"] as TabId[]).includes(
    raw as TabId
  )
    ? (raw as TabId)
    : "Details";
}

function sanitizeName(value: string) {
  return value.replace(/[^a-zA-Z0-9 .,&'\-]/g, "").slice(0, NAME_MAX);
}

function sanitizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, PHONE_MAX);
}

function sanitizeEmail(value: string) {
  return value.replace(/\s/g, "").slice(0, EMAIL_MAX);
}

function isValidEmail(value: string) {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function Field({
  label,
  children,
  className,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="mb-0 text-[13px] font-semibold text-stone-800 dark:text-stone-100">{label}</Label>
      {hint ? <p className="text-xs text-stone-500">{hint}</p> : null}
      {children}
    </div>
  );
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { push } = useToast();
  const [tab, setTab] = useState<TabId>(() => resolveTab(searchParams.get("tab")));
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editReasonOpen, setEditReasonOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [comment, setComment] = useState("");
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState<Partial<Client> | null>(null);
  const [budgetConfirmed, setBudgetConfirmed] = useState<"yes" | "no">("no");
  const [followUpNeeded, setFollowUpNeeded] = useState<"yes" | "no">("no");
  const [docsNeeded, setDocsNeeded] = useState<"yes" | "no">("no");
  const [followUpTime, setFollowUpTime] = useState("");
  const [followUpMeetingType, setFollowUpMeetingType] = useState<"online" | "offline">("online");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [docType, setDocType] = useState<AttachmentDocumentType>("proposal");
  const [docTypeOther, setDocTypeOther] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docNotes, setDocNotes] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const docFileRef = useRef<HTMLInputElement>(null);
  const detailsDocFileRef = useRef<HTMLInputElement>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMemberId, setAssignMemberId] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [workingEditId, setWorkingEditId] = useState<string | null>(null);
  const [workingEditNote, setWorkingEditNote] = useState("");
  const [workingEditMemberId, setWorkingEditMemberId] = useState("");
  const [workingEditReason, setWorkingEditReason] = useState("");
  const [workingEditReasonOpen, setWorkingEditReasonOpen] = useState(false);
  const [workingEditUnlocked, setWorkingEditUnlocked] = useState(false);
  const [workingRemoveRow, setWorkingRemoveRow] = useState<LeadWorking | null>(null);

  useEffect(() => {
    setTab(resolveTab(searchParams.get("tab")));
  }, [searchParams]);

  const client = useMemo(() => getClient(params.id), [params.id, tick]);

  const resetDocForm = () => {
    setDocType("proposal");
    setDocTypeOther("");
    setDocTitle("");
    setDocNotes("");
    setDocFile(null);
    if (docFileRef.current) docFileRef.current.value = "";
    if (detailsDocFileRef.current) detailsDocFileRef.current.value = "";
  };

  const hydrateFromClient = (c: Client) => {
    setForm({ ...c, customFields: { ...(c.customFields ?? {}) } });
    setBudgetConfirmed(c.customFields?.budget_confirmed === true ? "yes" : "no");
    const hasFollowUp = Boolean(c.nextFollowUpDate);
    setFollowUpNeeded(hasFollowUp ? "yes" : "no");
    setFollowUpTime(String(c.customFields?.follow_up_time ?? ""));
    setFollowUpMeetingType(
      (c.customFields?.follow_up_meeting_type as "online" | "offline") || "online"
    );
    setFollowUpNotes(String(c.customFields?.follow_up_notes ?? ""));
    setDocsNeeded("no");
    resetDocForm();
  };

  useEffect(() => {
    if (!client) return;
    if (editing) return;
    hydrateFromClient(client);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  if (!client || !form) {
    return <p className="p-6">Lead not found.</p>;
  }

  const session = getSession();
  const sourceMeta = LEAD_SOURCES.find((s) => s.id === (form.leadSourceId ?? client.leadSourceId));
  const serviceMeta = SERVICES.find((s) => s.id === (form.serviceId ?? client.serviceId));
  const source = sourceMeta?.name;
  const service = serviceMeta?.name;
  const stage = STAGES.find((s) => s.id === (form.stageId ?? client.stageId))?.name;
  const sourceAllowsOther = Boolean(sourceMeta?.allowsOtherText);
  const serviceAllowsOther = Boolean(serviceMeta?.allowsOtherText);
  const leadFollowups = followups.filter((f) => f.clientId === client.id);
  const leadComments = comments.filter((c) => c.clientId === client.id);
  const leadHistory = activities.filter((a) => a.clientId === client.id);
  const leadDocs = attachments.filter((a) => a.clientId === client.id);
  const leadWorking = working.filter((w) => w.clientId === client.id && w.isActive);
  const firstCallYes = form.firstCallCompleted === true;
  const locked = !editing;
  const assignableMembers = TEAM.filter(
    (t) => t.isActive && !leadWorking.some((w) => w.teamMemberId === t.id)
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: "Details", label: "Details" },
    { id: "Comments", label: `Comments${leadComments.length ? ` (${leadComments.length})` : ""}` },
    { id: "History", label: "History" },
    { id: "Follow-ups", label: `Follow-ups${leadFollowups.length ? ` (${leadFollowups.length})` : ""}` },
    { id: "Docs", label: `Docs${leadDocs.length ? ` (${leadDocs.length})` : ""}` },
    { id: "Working", label: `Working${leadWorking.length ? ` (${leadWorking.length})` : ""}` },
  ];

  const selectClass = cn(
    "h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900",
    locked && "cursor-not-allowed opacity-70"
  );

  const patch = <K extends keyof Client>(key: K, value: Client[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const buildCustomFields = () => ({
    ...(form.customFields ?? {}),
    budget_confirmed: budgetConfirmed === "yes",
    follow_up_needed: followUpNeeded === "yes",
    follow_up_time: followUpNeeded === "yes" ? followUpTime : undefined,
    follow_up_meeting_type: followUpNeeded === "yes" ? followUpMeetingType : undefined,
    follow_up_notes: followUpNeeded === "yes" ? followUpNotes : undefined,
    docs_needed: docsNeeded === "yes",
  });

  const attachPendingDoc = async () => {
    if (!session || !docFile) return false;
    if (!docTitle.trim()) {
      push("Enter a document name", "error");
      return false;
    }
    if (docType === "other" && !docTypeOther.trim()) {
      push("Please briefly explain what this other document is", "error");
      return false;
    }
    const fileError = validateAttachmentFile(docFile);
    if (fileError) {
      push(fileError, "error");
      return false;
    }
    const fileDataUrl = await readFileAsDataUrl(docFile);
    const id = uid("at");
    attachments.unshift({
      id,
      clientId: client.id,
      originalFilename: docFile.name,
      documentType: docType,
      documentTypeOther: docType === "other" ? docTypeOther.trim() : undefined,
      title: docTitle.trim(),
      description: docNotes.trim() || undefined,
      fileType: docFile.type || "application/octet-stream",
      fileSize: docFile.size,
      uploadedById: session.teamMemberId,
      uploadedAt: new Date().toISOString(),
      fileDataUrl,
    });
    pushActivity({
      actorId: session.teamMemberId,
      action: "attachment_uploaded",
      entityType: "Attachment",
      entityId: id,
      clientId: client.id,
      reason: editReason || undefined,
      newValues: { title: docTitle.trim(), documentType: docType, filename: docFile.name },
    });
    return true;
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditReason("");
    hydrateFromClient(client);
  };

  const saveDetails = async () => {
    if (!session || !form) return;
    if (!editReason.trim()) {
      setEditReasonOpen(true);
      return;
    }
    if (!form.clientName?.trim() || form.clientName.trim().length < 2) {
      push("Client name must be at least 2 characters", "error");
      return;
    }
    if (!form.primaryPhone || form.primaryPhone.length < 8) {
      push("Primary phone must be 8–15 digits", "error");
      return;
    }
    if (form.alternatePhone && form.alternatePhone.length < 8) {
      push("Alternate phone must be 8–15 digits", "error");
      return;
    }
    if (!isValidEmail(form.primaryEmail ?? "")) {
      push("Enter a valid primary email", "error");
      return;
    }
    if (!isValidEmail(form.decisionMakerEmail ?? "")) {
      push("Enter a valid decision-maker email", "error");
      return;
    }
    if (sourceAllowsOther && !form.leadSourceOther?.trim()) {
      push("Please briefly explain the other lead source", "error");
      return;
    }
    if (serviceAllowsOther && !form.serviceOther?.trim()) {
      push("Please briefly explain the other service", "error");
      return;
    }
    if (budgetConfirmed === "yes" && (form.estimatedDealValue == null || Number.isNaN(form.estimatedDealValue))) {
      push("Enter budget / deal value details", "error");
      return;
    }
    if (followUpNeeded === "yes" && !form.nextFollowUpDate) {
      push("Enter the next follow-up date", "error");
      return;
    }
    if (docsNeeded === "yes" && !docFile) {
      push("Upload a document or set “Any documents to attach?” to No", "error");
      return;
    }

    try {
      const customFields = buildCustomFields();
      updateClient(
        client.id,
        {
          clientName: form.clientName?.trim(),
          primaryPhone: form.primaryPhone,
          alternatePhone: form.alternatePhone || undefined,
          primaryEmail: form.primaryEmail?.trim() || undefined,
          alternateEmail: form.alternateEmail?.trim() || undefined,
          leadSourceId: form.leadSourceId,
          leadSourceOther: form.leadSourceOther,
          serviceId: form.serviceId,
          serviceOther: form.serviceOther,
          stageId: form.stageId,
          firstCallCompleted: Boolean(form.firstCallCompleted),
          clientRequirements: form.clientRequirements,
          firstCallNotes: form.firstCallNotes,
          decisionMakerPhone: form.decisionMakerPhone || undefined,
          decisionMakerEmail: form.decisionMakerEmail?.trim() || undefined,
          estimatedDealValue: budgetConfirmed === "yes" ? form.estimatedDealValue : undefined,
          nextFollowUpDate: followUpNeeded === "yes" ? form.nextFollowUpDate : undefined,
          callDiscussionNotes: form.callDiscussionNotes,
          customFields,
        },
        session.teamMemberId,
        editReason
      );

      if (followUpNeeded === "yes" && form.nextFollowUpDate) {
        const existing = followups.find(
          (f) => f.clientId === client.id && f.followUpDate === form.nextFollowUpDate && f.status === "pending"
        );
        if (!existing) {
          const fuId = uid("fu");
          followups.unshift({
            id: fuId,
            clientId: client.id,
            followUpDate: form.nextFollowUpDate,
            updatedById: session.teamMemberId,
            notes: followUpNotes || "Follow-up scheduled from lead details",
            nextAction: followUpTime
              ? `Meeting ${followUpMeetingType} at ${followUpTime}`
              : `Follow-up (${followUpMeetingType})`,
            status: "pending",
          });
          pushActivity({
            actorId: session.teamMemberId,
            action: "followup_scheduled",
            entityType: "FollowUp",
            entityId: fuId,
            clientId: client.id,
            reason: editReason,
            newValues: {
              followUpDate: form.nextFollowUpDate,
              notes: followUpNotes || "Follow-up scheduled from lead details",
            },
          });
        }
      }

      if (docsNeeded === "yes") {
        const ok = await attachPendingDoc();
        if (!ok) return;
      }

      setEditing(false);
      setEditReason("");
      setDocsNeeded("no");
      resetDocForm();
      setTick((t) => t + 1);
      push("Lead details saved");
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes("reason")) {
        setEditReasonOpen(true);
        return;
      }
      push(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  const saveDocFromDocsTab = async () => {
    if (!session) return;
    if (!docTitle.trim()) {
      push("Enter a document name", "error");
      return;
    }
    if (docType === "other" && !docTypeOther.trim()) {
      push("Please briefly explain what this other document is", "error");
      return;
    }
    if (!docFile) {
      push("Upload a file (PDF, DOC, or DOCX, under 5 MB)", "error");
      return;
    }
    const ok = await attachPendingDoc();
    if (!ok) return;
    setAttachOpen(false);
    resetDocForm();
    setTick((t) => t + 1);
    push("Document attached");
  };

  const resetAssignForm = () => {
    setAssignMemberId("");
    setAssignNote("");
  };

  const cancelWorkingEdit = () => {
    setWorkingEditId(null);
    setWorkingEditNote("");
    setWorkingEditMemberId("");
    setWorkingEditReason("");
    setWorkingEditUnlocked(false);
  };

  const assignWorking = () => {
    if (!session) return;
    if (!assignMemberId) {
      push("Select a team member", "error");
      return;
    }
    if (!assignNote.trim()) {
      push("Enter what they are working on", "error");
      return;
    }
    if (working.some((w) => w.clientId === client.id && w.teamMemberId === assignMemberId && w.isActive)) {
      push("That team member is already working on this lead", "error");
      return;
    }
    const stamp = new Date().toISOString();
    const id = uid("wk");
    const memberName = TEAM.find((t) => t.id === assignMemberId)?.displayName ?? "Member";
    working.unshift({
      id,
      clientId: client.id,
      teamMemberId: assignMemberId,
      workNote: assignNote.trim(),
      assignedById: session.teamMemberId,
      assignedAt: stamp,
      updatedAt: stamp,
      isActive: true,
    });
    pushActivity({
      actorId: session.teamMemberId,
      action: "working_assigned",
      entityType: "LeadWorking",
      entityId: id,
      clientId: client.id,
      newValues: {
        teamMemberId: assignMemberId,
        teamMemberName: memberName,
        workNote: assignNote.trim(),
      },
    });
    setAssignOpen(false);
    resetAssignForm();
    setTick((t) => t + 1);
    push(`${memberName} assigned to this lead`);
  };

  const startWorkingEdit = (row: LeadWorking) => {
    setWorkingEditId(row.id);
    setWorkingEditNote(row.workNote);
    setWorkingEditMemberId(row.teamMemberId);
    setWorkingEditReason("");
    setWorkingEditUnlocked(false);
    setWorkingEditReasonOpen(true);
  };

  const saveWorkingEdit = () => {
    if (!session || !workingEditId) return;
    if (!workingEditReason.trim()) {
      setWorkingEditReasonOpen(true);
      return;
    }
    if (!workingEditNote.trim()) {
      push("Enter what they are working on", "error");
      return;
    }
    if (!workingEditMemberId) {
      push("Select a team member", "error");
      return;
    }
    const idx = working.findIndex((w) => w.id === workingEditId);
    if (idx < 0) return;
    const current = working[idx];
    const duplicate = working.some(
      (w) =>
        w.id !== workingEditId &&
        w.clientId === client.id &&
        w.teamMemberId === workingEditMemberId &&
        w.isActive
    );
    if (duplicate) {
      push("That team member is already working on this lead", "error");
      return;
    }
    const prevMember = TEAM.find((t) => t.id === current.teamMemberId)?.displayName ?? "Member";
    const nextMember = TEAM.find((t) => t.id === workingEditMemberId)?.displayName ?? "Member";
    working[idx] = {
      ...current,
      teamMemberId: workingEditMemberId,
      workNote: workingEditNote.trim(),
      updatedById: session.teamMemberId,
      updatedAt: new Date().toISOString(),
    };
    pushActivity({
      actorId: session.teamMemberId,
      action: "working_updated",
      entityType: "LeadWorking",
      entityId: workingEditId,
      clientId: client.id,
      reason: workingEditReason.trim(),
      oldValues: {
        teamMemberId: current.teamMemberId,
        teamMemberName: prevMember,
        workNote: current.workNote,
      },
      newValues: {
        teamMemberId: workingEditMemberId,
        teamMemberName: nextMember,
        workNote: workingEditNote.trim(),
      },
    });
    cancelWorkingEdit();
    setTick((t) => t + 1);
    push("Working assignment updated");
  };

  const removeWorking = (row: LeadWorking, reason: string) => {
    if (!session) return;
    const idx = working.findIndex((w) => w.id === row.id);
    if (idx < 0) return;
    const memberName = TEAM.find((t) => t.id === row.teamMemberId)?.displayName ?? "Member";
    working[idx] = { ...working[idx], isActive: false, updatedById: session.teamMemberId, updatedAt: new Date().toISOString() };
    pushActivity({
      actorId: session.teamMemberId,
      action: "working_removed",
      entityType: "LeadWorking",
      entityId: row.id,
      clientId: client.id,
      reason,
      oldValues: { teamMemberName: memberName, workNote: row.workNote },
      newValues: { isActive: false },
    });
    if (workingEditId === row.id) cancelWorkingEdit();
    setTick((t) => t + 1);
    push(`${memberName} removed from this lead`);
  };

  const onDocFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    ref: React.RefObject<HTMLInputElement | null>
  ) => {
    const next = e.target.files?.[0] ?? null;
    if (!next) {
      setDocFile(null);
      return;
    }
    const error = validateAttachmentFile(next);
    if (error) {
      push(error, "error");
      e.target.value = "";
      setDocFile(null);
      return;
    }
    setDocFile(next);
    if (!docTitle.trim()) setDocTitle(next.name.replace(/\.[^.]+$/, "").slice(0, NAME_MAX));
    void ref;
  };

  const renderDocFields = (fileRef: React.RefObject<HTMLInputElement | null>, disabled = false) => (
    <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/40 p-4 dark:border-violet-900 dark:bg-violet-950/20">
      <h2 className="font-medium">Document details</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Document type">
          <select
            className={selectClass}
            disabled={disabled}
            value={docType}
            onChange={(e) => {
              const next = e.target.value as AttachmentDocumentType;
              setDocType(next);
              if (next !== "other") setDocTypeOther("");
            }}
          >
            {DOCUMENT_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        {docType === "other" ? (
          <Field label="Please describe this other document">
            <Input
              disabled={disabled}
              placeholder="Briefly explain what this file is"
              value={docTypeOther}
              onChange={(e) => setDocTypeOther(e.target.value)}
            />
          </Field>
        ) : null}
        <Field label="Document name" className="sm:col-span-2">
          <Input
            disabled={disabled}
            maxLength={NAME_MAX}
            placeholder="e.g. Q1 pricing proposal"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value.slice(0, NAME_MAX))}
          />
        </Field>
        <Field label="Notes (optional)" className="sm:col-span-2">
          <Textarea
            disabled={disabled}
            placeholder="Short context for the team — who shared this file, version, or next step"
            value={docNotes}
            onChange={(e) => setDocNotes(e.target.value)}
          />
        </Field>
        <Field label="Upload file" className="sm:col-span-2">
          <Input
            ref={fileRef}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            disabled={disabled}
            onChange={(e) => onDocFileChange(e, fileRef)}
          />
          <p className="mt-1.5 text-xs text-stone-500">Allowed: PDF, DOC, DOCX · Max size: 5 MB</p>
        </Field>
      </div>
      <p className="text-xs text-stone-500">
        This file also appears under the Docs tab after you save.
      </p>
    </div>
  );

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col p-3 sm:p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-stone-500">
            <Link href="/boards" className="underline">
              Boards
            </Link>{" "}
            / {client.clientName}
          </p>
          <h1 className="font-display text-2xl tracking-tight sm:text-3xl">{client.clientName}</h1>
          <p className="text-sm text-stone-500">
            {stage} · {source} · {service}
            {editing ? " · Editing" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push("/boards")}>
            Close
          </Button>
        </div>
      </div>

      <div className="mb-4 flex w-full gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-stone-100/80 p-1 dark:border-stone-800 dark:bg-stone-900/70">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              router.replace(`/leads/${client.id}?tab=${encodeURIComponent(item.id)}`, {
                scroll: false,
              });
            }}
            className={cn(
              "min-w-0 flex-1 whitespace-nowrap rounded-lg px-2 py-2.5 text-center text-sm transition sm:px-3",
              tab === item.id
                ? "bg-white font-medium text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-50"
                : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-sm dark:border-stone-800 dark:bg-stone-950/70 sm:p-5">
        {tab === "Details" ? (
          <div className="space-y-4">
            {!editing ? (
              <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-900/40 dark:text-stone-300">
                Fields are locked. Click <span className="font-medium">Edit</span>, enter why you are
                changing something, then update fields and click <span className="font-medium">Save</span>.
              </p>
            ) : (
              <p className="rounded-lg border border-teal-200 bg-teal-50/70 px-3 py-2 text-sm text-teal-900 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100">
                Editing unlocked. Reason: <span className="font-medium">{editReason}</span>
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client name">
                <Input
                  disabled={locked}
                  maxLength={NAME_MAX}
                  value={form.clientName ?? ""}
                  onChange={(e) => patch("clientName", sanitizeName(e.target.value))}
                />
              </Field>
              <Field label="Primary phone">
                <Input
                  disabled={locked}
                  inputMode="numeric"
                  maxLength={PHONE_MAX}
                  placeholder="8–15 digits"
                  value={form.primaryPhone ?? ""}
                  onChange={(e) => patch("primaryPhone", sanitizePhone(e.target.value))}
                />
              </Field>
              <Field label="Alternate phone">
                <Input
                  disabled={locked}
                  inputMode="numeric"
                  maxLength={PHONE_MAX}
                  placeholder="Optional · 8–15 digits"
                  value={form.alternatePhone ?? ""}
                  onChange={(e) => patch("alternatePhone", sanitizePhone(e.target.value))}
                />
              </Field>
              <Field label="Primary email">
                <Input
                  disabled={locked}
                  type="email"
                  maxLength={EMAIL_MAX}
                  placeholder="name@company.com"
                  value={form.primaryEmail ?? ""}
                  onChange={(e) => patch("primaryEmail", sanitizeEmail(e.target.value))}
                />
              </Field>
              <Field label="Channel source" className="col-span-full">
                <select
                  className={cn(selectClass, "w-full")}
                  disabled={locked}
                  value={form.leadSourceId ?? ""}
                  onChange={(e) => {
                    const next = e.target.value;
                    patch("leadSourceId", next);
                    if (!LEAD_SOURCES.find((s) => s.id === next)?.allowsOtherText) {
                      patch("leadSourceOther", undefined);
                    }
                  }}
                >
                  {LEAD_SOURCES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              {sourceAllowsOther ? (
                <Field label="Please describe this other channel source" className="col-span-full">
                  <Input
                    disabled={locked}
                    placeholder="Briefly explain where this lead came from"
                    value={form.leadSourceOther ?? ""}
                    onChange={(e) => patch("leadSourceOther", e.target.value)}
                  />
                </Field>
              ) : null}
              <Field
                label="Lead Source people"
                className="col-span-full"
                hint={
                  <>
                    Read-only. Assign from{" "}
                    <Link href="/lead-source" className="underline">
                      Lead Source
                    </Link>{" "}
                    tab.
                  </>
                }
              >
                <div
                  className={cn(
                    "flex min-h-10 w-full flex-wrap items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900",
                    locked && "cursor-not-allowed opacity-70"
                  )}
                >
                  {peopleForClient(client.id).length === 0 ? (
                    <span className="text-stone-400">None linked</span>
                  ) : (
                    peopleForClient(client.id).map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 dark:border-stone-700 dark:bg-stone-900/80"
                      >
                        <span className="truncate font-medium text-stone-900 dark:text-stone-100">
                          {p.displayName}
                        </span>
                        {p.roleLabel ? (
                          <span className="truncate text-stone-500">· {p.roleLabel}</span>
                        ) : null}
                      </span>
                    ))
                  )}
                </div>
              </Field>
              <Field label="Service">
                <select
                  className={selectClass}
                  disabled={locked}
                  value={form.serviceId ?? ""}
                  onChange={(e) => {
                    const next = e.target.value;
                    patch("serviceId", next);
                    if (!SERVICES.find((s) => s.id === next)?.allowsOtherText) {
                      patch("serviceOther", undefined);
                    }
                  }}
                >
                  {SERVICES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              {serviceAllowsOther ? (
                <Field label="Please describe this other service" className="sm:col-span-2">
                  <Input
                    disabled={locked}
                    placeholder="Briefly explain what the client needs"
                    value={form.serviceOther ?? ""}
                    onChange={(e) => patch("serviceOther", e.target.value)}
                  />
                </Field>
              ) : null}
              <Field label="Stage">
                <select
                  className={selectClass}
                  disabled={locked}
                  value={form.stageId ?? ""}
                  onChange={(e) => patch("stageId", e.target.value)}
                >
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Has the first call been completed?">
                <select
                  className={selectClass}
                  disabled={locked}
                  value={firstCallYes ? "yes" : "no"}
                  onChange={(e) => patch("firstCallCompleted", e.target.value === "yes")}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </Field>
            </div>

            {firstCallYes ? (
              <div className="space-y-3 rounded-lg border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-900 dark:bg-teal-950/20">
                <h2 className="font-medium">Post-call information</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Decision-maker phone">
                    <Input
                      disabled={locked}
                      inputMode="numeric"
                      maxLength={PHONE_MAX}
                      placeholder="8–15 digits"
                      value={form.decisionMakerPhone ?? ""}
                      onChange={(e) => patch("decisionMakerPhone", sanitizePhone(e.target.value))}
                    />
                  </Field>
                  <Field label="Decision-maker email">
                    <Input
                      disabled={locked}
                      type="email"
                      maxLength={EMAIL_MAX}
                      placeholder="name@company.com"
                      value={form.decisionMakerEmail ?? ""}
                      onChange={(e) => patch("decisionMakerEmail", sanitizeEmail(e.target.value))}
                    />
                  </Field>
                  <Field label="Client requirements" className="sm:col-span-2">
                    <Textarea
                      disabled={locked}
                      placeholder="What the client needs, goals, constraints"
                      value={form.clientRequirements ?? ""}
                      onChange={(e) => patch("clientRequirements", e.target.value)}
                    />
                  </Field>
                  <Field label="Call discussion notes" className="sm:col-span-2">
                    <Textarea
                      disabled={locked}
                      placeholder="Key points from the conversation"
                      value={form.callDiscussionNotes ?? ""}
                      onChange={(e) => patch("callDiscussionNotes", e.target.value)}
                    />
                  </Field>
                  <Field label="First call notes" className="sm:col-span-2">
                    <Textarea
                      disabled={locked}
                      placeholder="Internal notes from the first call"
                      value={form.firstCallNotes ?? ""}
                      onChange={(e) => patch("firstCallNotes", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            <Field label="Next follow-up needed?">
              <select
                className={selectClass}
                disabled={locked}
                value={followUpNeeded}
                onChange={(e) => setFollowUpNeeded(e.target.value as "yes" | "no")}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </Field>

            {followUpNeeded === "yes" ? (
              <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900 dark:bg-sky-950/20">
                <h2 className="font-medium">Follow-up details</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Follow-up date">
                    <Input
                      disabled={locked}
                      type="date"
                      value={form.nextFollowUpDate ?? ""}
                      onChange={(e) => patch("nextFollowUpDate", e.target.value)}
                    />
                  </Field>
                  <Field label="Meeting / call time">
                    <Input
                      disabled={locked}
                      type="time"
                      value={followUpTime}
                      onChange={(e) => setFollowUpTime(e.target.value)}
                    />
                  </Field>
                  <Field label="Meeting type">
                    <select
                      className={selectClass}
                      disabled={locked}
                      value={followUpMeetingType}
                      onChange={(e) =>
                        setFollowUpMeetingType(e.target.value as "online" | "offline")
                      }
                    >
                      <option value="online">Online</option>
                      <option value="offline">Offline</option>
                    </select>
                  </Field>
                  <Field label="Follow-up notes" className="sm:col-span-2">
                    <Textarea
                      disabled={locked}
                      placeholder="Agenda, who to meet, what to discuss"
                      value={followUpNotes}
                      onChange={(e) => setFollowUpNotes(e.target.value)}
                    />
                  </Field>
                </div>
                <p className="text-xs text-stone-500">
                  These details also appear under the Follow-ups tab after you save.
                </p>
              </div>
            ) : null}

            <Field label="Any documents to attach?">
              <select
                className={selectClass}
                disabled={locked}
                value={docsNeeded}
                onChange={(e) => {
                  const next = e.target.value as "yes" | "no";
                  setDocsNeeded(next);
                  if (next === "no") resetDocForm();
                }}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </Field>

            {docsNeeded === "yes" ? renderDocFields(detailsDocFileRef, locked) : null}

            <Field label="Budget confirmed?">
              <select
                className={selectClass}
                disabled={locked}
                value={budgetConfirmed}
                onChange={(e) => setBudgetConfirmed(e.target.value as "yes" | "no")}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </Field>

            {budgetConfirmed === "yes" ? (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                <h2 className="font-medium">Budget details</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Estimated deal / budget value">
                    <Input
                      disabled={locked}
                      type="number"
                      min={0}
                      placeholder="e.g. 85000"
                      value={form.estimatedDealValue ?? ""}
                      onChange={(e) =>
                        patch(
                          "estimatedDealValue",
                          e.target.value ? Number(e.target.value.slice(0, 12)) : undefined
                        )
                      }
                    />
                  </Field>
                  <Field label="Budget notes" className="sm:col-span-2">
                    <Textarea
                      disabled={locked}
                      placeholder="Who confirmed the budget, payment terms, inclusions/exclusions, and any conditions agreed on the call"
                      value={String(form.customFields?.budget_notes ?? "")}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                customFields: {
                                  ...(prev.customFields ?? {}),
                                  budget_notes: e.target.value,
                                },
                              }
                            : prev
                        )
                      }
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-stone-200 pt-4 dark:border-stone-800">
              {editing ? (
                <>
                  <Button onClick={() => void saveDetails()}>Save</Button>
                  <Button variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTab("Details");
                      setEditReasonOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="outline" onClick={() => setArchiveOpen(true)}>
                    <Archive className="h-4 w-4" />
                    Archive
                  </Button>
                  <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : null}

        {tab === "Working" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-stone-500">
                Only team members assigned to this lead appear here, with a note on what they are
                working on.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  if (assignOpen) {
                    setAssignOpen(false);
                    resetAssignForm();
                    return;
                  }
                  cancelWorkingEdit();
                  resetAssignForm();
                  setAssignOpen(true);
                }}
              >
                {assignOpen ? "Close form" : "Assign member"}
              </Button>
            </div>

            {assignOpen ? (
              <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4 dark:border-teal-900 dark:bg-teal-950/20">
                <h2 className="font-medium">Assign team member</h2>
                <Field label="Team member">
                  <select
                    className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900"
                    value={assignMemberId}
                    onChange={(e) => setAssignMemberId(e.target.value)}
                  >
                    <option value="">Select member…</option>
                    {assignableMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName} · {m.jobTitle}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="What are they working on?">
                  <Textarea
                    placeholder="Short note — e.g. preparing proposal, client follow-up, technical scope"
                    value={assignNote}
                    onChange={(e) => setAssignNote(e.target.value)}
                  />
                </Field>
                <div className="flex gap-2">
                  <Button onClick={assignWorking}>Assign</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAssignOpen(false);
                      resetAssignForm();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            <ul className="space-y-2">
              {leadWorking.map((row) => {
                const member = TEAM.find((t) => t.id === row.teamMemberId);
                const assignedBy = TEAM.find((t) => t.id === row.assignedById);
                const updatedBy = row.updatedById
                  ? TEAM.find((t) => t.id === row.updatedById)
                  : null;
                const isEditingRow = workingEditId === row.id && workingEditUnlocked;
                return (
                  <li
                    key={row.id}
                    className="rounded-xl border border-stone-200 p-3 dark:border-stone-800"
                  >
                    {isEditingRow ? (
                      <div className="space-y-3">
                        <p className="text-xs text-teal-800 dark:text-teal-200">
                          Editing unlocked · Reason: {workingEditReason}
                        </p>
                        <Field label="Team member">
                          <select
                            className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900"
                            value={workingEditMemberId}
                            onChange={(e) => setWorkingEditMemberId(e.target.value)}
                          >
                            {TEAM.filter((t) => t.isActive).map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.displayName} · {m.jobTitle}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="What are they working on?">
                          <Textarea
                            placeholder="Update the work note"
                            value={workingEditNote}
                            onChange={(e) => setWorkingEditNote(e.target.value)}
                          />
                        </Field>
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={saveWorkingEdit}>Save</Button>
                          <Button variant="outline" onClick={cancelWorkingEdit}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium">{member?.displayName ?? "Unknown member"}</p>
                            <p className="mt-0.5 text-xs text-stone-500">
                              {member?.jobTitle ?? "Team"} · Assigned by{" "}
                              {assignedBy?.displayName ?? "—"} · {formatDateTime(row.assignedAt)}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button size="sm" variant="outline" onClick={() => startWorkingEdit(row)}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setWorkingRemoveRow(row)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-stone-700 dark:text-stone-200">
                          <span className="font-medium text-stone-500">Working on: </span>
                          {row.workNote}
                        </p>
                        {updatedBy ? (
                          <p className="mt-1 text-xs text-stone-500">
                            Last edited by {updatedBy.displayName} · {formatDateTime(row.updatedAt)}
                          </p>
                        ) : null}
                      </>
                    )}
                  </li>
                );
              })}
              {leadWorking.length === 0 ? (
                <li className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500 dark:border-stone-700">
                  No one is working on this lead yet. Assign a team member above.
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {tab === "Comments" ? (
          <div className="space-y-3">
            {leadComments.map((c) => (
              <div key={c.id} className="rounded-xl border border-stone-200 p-3 dark:border-stone-800">
                <p className="text-sm">{c.body}</p>
                <p className="mt-2 text-xs text-stone-500">
                  {TEAM.find((t) => t.id === c.authorId)?.displayName ?? "Team"} ·{" "}
                  {formatDateTime(c.createdAt)}
                </p>
              </div>
            ))}
            {leadComments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500 dark:border-stone-700">
                No comments yet.
              </p>
            ) : null}
            <Field label="Add comment">
              <Textarea
                placeholder="Write a comment for the team"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </Field>
            <Button
              onClick={() => {
                if (!comment.trim() || !session) return;
                const cmId = `cm-${Date.now()}`;
                comments.unshift({
                  id: cmId,
                  clientId: client.id,
                  authorId: session.teamMemberId,
                  body: comment.trim(),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
                pushActivity({
                  actorId: session.teamMemberId,
                  action: "comment_added",
                  entityType: "Comment",
                  entityId: cmId,
                  clientId: client.id,
                  newValues: { body: comment.trim() },
                });
                setComment("");
                setTick((t) => t + 1);
                push("Comment added");
              }}
            >
              Add comment
            </Button>
          </div>
        ) : null}

        {tab === "History" ? (
          <ul className="space-y-2">
            {leadHistory.map((a) => {
              const changes = formatChangeSummary(a.oldValues, a.newValues);
              return (
                <li
                  key={a.id}
                  className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm dark:border-stone-800"
                >
                  <p className="font-medium">{actionLabel(a.action)}</p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {TEAM.find((t) => t.id === a.actorId)?.displayName ?? "System"} ·{" "}
                    {formatDateTime(a.timestamp)} · {entityLabel(a.entityType)}
                  </p>
                  {a.reason ? (
                    <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">
                      <span className="font-medium">Reason:</span> {a.reason}
                    </p>
                  ) : null}
                  {changes.length > 0 ? (
                    <ul className="mt-2 space-y-0.5 rounded-lg bg-stone-50 px-2.5 py-2 text-xs text-stone-600 dark:bg-stone-900/50 dark:text-stone-300">
                      {changes.map((line) => (
                        <li key={line}>• {line}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
            {leadHistory.length === 0 ? (
              <li className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500 dark:border-stone-700">
                No history yet.
              </li>
            ) : null}
          </ul>
        ) : null}

        {tab === "Follow-ups" ? (
          <ul className="space-y-2">
            {leadFollowups.map((f) => (
              <li
                key={f.id}
                className="rounded-xl border border-stone-200 p-3 text-sm dark:border-stone-800"
              >
                <p className="font-medium">
                  {formatDate(f.followUpDate)} · {f.status}
                </p>
                <p className="mt-1 text-stone-600 dark:text-stone-300">{f.notes}</p>
                {f.nextAction ? (
                  <p className="mt-1 text-xs text-stone-500">Next: {f.nextAction}</p>
                ) : null}
              </li>
            ))}
            {client.nextFollowUpDate ? (
              <li className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-sm dark:border-sky-900 dark:bg-sky-950/20">
                <p className="font-medium">Scheduled from details</p>
                <p className="mt-1">
                  Date: {formatDate(client.nextFollowUpDate)}
                  {String(client.customFields?.follow_up_time ?? "")
                    ? ` · Time: ${String(client.customFields?.follow_up_time)}`
                    : ""}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Meeting: {String(client.customFields?.follow_up_meeting_type ?? "—")}
                  {client.customFields?.follow_up_notes
                    ? ` · ${String(client.customFields.follow_up_notes)}`
                    : ""}
                </p>
              </li>
            ) : null}
            {leadFollowups.length === 0 && !client.nextFollowUpDate ? (
              <li className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500 dark:border-stone-700">
                No follow-ups yet. Set “Next follow-up needed?” to Yes in Details.
              </li>
            ) : null}
          </ul>
        ) : null}

        {tab === "Docs" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-stone-500">Documents linked to this lead.</p>
              <Button
                variant="outline"
                onClick={() => {
                  if (attachOpen) {
                    setAttachOpen(false);
                    resetDocForm();
                    return;
                  }
                  resetDocForm();
                  setAttachOpen(true);
                }}
              >
                {attachOpen ? "Close form" : "Attach document"}
              </Button>
            </div>

            {attachOpen ? (
              <div className="space-y-3">
                {renderDocFields(docFileRef, false)}
                <div className="flex gap-2">
                  <Button onClick={() => void saveDocFromDocsTab()}>Save document</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAttachOpen(false);
                      resetDocForm();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            <ul className="space-y-2">
              {leadDocs.map((a) => {
                const typeLabel =
                  a.documentType === "other" && a.documentTypeOther
                    ? `Other · ${a.documentTypeOther}`
                    : documentTypeLabel(a.documentType);
                return (
                  <li
                    key={a.id}
                    className="rounded-xl border border-stone-200 p-3 text-sm dark:border-stone-800"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{a.title}</p>
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                        {typeLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      {a.originalFilename} · {(a.fileSize / 1024).toFixed(1)} KB ·{" "}
                      {TEAM.find((t) => t.id === a.uploadedById)?.displayName ?? "—"} ·{" "}
                      {formatDateTime(a.uploadedAt)}
                    </p>
                    {a.description ? (
                      <p className="mt-1 text-xs text-stone-500">{a.description}</p>
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
                    </div>
                  </li>
                );
              })}
              {leadDocs.length === 0 ? (
                <li className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500 dark:border-stone-700">
                  No documents yet. Attach from Details or use Attach document above.
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>

      <ReasonDialog
        open={deleteOpen}
        title="Delete client"
        description="A reason is mandatory for client deletion."
        onClose={() => setDeleteOpen(false)}
        onConfirm={(reason) => {
          if (!session) return;
          deleteClient(client.id, session.teamMemberId, reason);
          push("Client deleted");
          router.push("/boards");
        }}
      />
      <ReasonDialog
        open={archiveOpen}
        title="Archive lead"
        description="A reason is required to archive this lead."
        onClose={() => setArchiveOpen(false)}
        onConfirm={(reason) => {
          if (!session) return;
          pushActivity({
            actorId: session.teamMemberId,
            action: "client_updated",
            entityType: "Client",
            entityId: client.id,
            clientId: client.id,
            reason: `Archived: ${reason}`,
            newValues: { archived: true },
          });
          setArchiveOpen(false);
          setTick((t) => t + 1);
          push("Lead archived (mock)");
        }}
      />
      <ReasonDialog
        open={editReasonOpen}
        title="Edit lead"
        description="Explain what you are changing (e.g. correct client name, update phone, attach docs)."
        onClose={() => setEditReasonOpen(false)}
        onConfirm={(reason) => {
          setEditReason(reason);
          setEditReasonOpen(false);
          setEditing(true);
          setTab("Details");
          push("Editing unlocked — make your changes, then click Save");
        }}
      />
      <ReasonDialog
        open={workingEditReasonOpen}
        title="Edit working assignment"
        description="Explain why you are changing who is working or their work note."
        onClose={() => {
          setWorkingEditReasonOpen(false);
          if (!workingEditUnlocked) cancelWorkingEdit();
        }}
        onConfirm={(reason) => {
          setWorkingEditReason(reason);
          setWorkingEditReasonOpen(false);
          setWorkingEditUnlocked(true);
          push("Working edit unlocked — update and click Save");
        }}
      />
      <ReasonDialog
        open={Boolean(workingRemoveRow)}
        title="Remove from working"
        description="A reason is required to remove this team member from the lead."
        onClose={() => setWorkingRemoveRow(null)}
        onConfirm={(reason) => {
          if (!workingRemoveRow) return;
          removeWorking(workingRemoveRow, reason);
          setWorkingRemoveRow(null);
        }}
      />
    </div>
  );
}
