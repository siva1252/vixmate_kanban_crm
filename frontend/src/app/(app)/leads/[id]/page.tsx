"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CUSTOM_FIELDS,
  LEAD_SOURCES,
  SERVICES,
  STAGES,
  TEAM,
  assignments,
  attachments,
  calls,
  comments,
  contacts,
  followups,
  meetings,
  tasks,
  activities,
} from "@/mock-data/store";
import { deleteClient, getClient, markFirstCallComplete, updateClient } from "@/mock-services/clients";
import { getSession } from "@/mock-services/auth";
import { useToast } from "@/components/toast";
import { formatDate, formatDateTime } from "@/lib/utils";

const tabs = [
  "Overview",
  "Contacts",
  "Calls",
  "Comments",
  "Activity",
  "Tasks",
  "Meetings",
  "Files",
] as const;

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dealReasonOpen, setDealReasonOpen] = useState(false);
  const [pendingDeal, setPendingDeal] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [tick, setTick] = useState(0);

  const client = useMemo(() => getClient(params.id), [params.id, tick]);
  if (!client) {
    return <p>Lead not found.</p>;
  }

  const session = getSession();
  const source = LEAD_SOURCES.find((s) => s.id === client.leadSourceId)?.name;
  const service = SERVICES.find((s) => s.id === client.serviceId)?.name;
  const stage = STAGES.find((s) => s.id === client.stageId)?.name;
  const assigned = assignments
    .filter((a) => a.clientId === client.id && a.isActive)
    .map((a) => TEAM.find((t) => t.id === a.teamMemberId)?.displayName)
    .filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500">
            <Link href="/leads" className="underline">
              Leads
            </Link>{" "}
            / {client.clientName}
          </p>
          <h1 className="font-display text-3xl">{client.clientName}</h1>
          <p className="text-sm text-stone-500">
            {stage} · {source} · {service}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/leads/${client.id}/edit`)}>
            Edit
          </Button>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`rounded-full px-3 py-1 text-sm ${
              tab === item ? "bg-teal-900 text-white" : "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-white/80 p-4 dark:border-stone-800 dark:bg-stone-950/60">
        {tab === "Overview" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <p>Phone: {client.primaryPhone}</p>
            <p>Email: {client.primaryEmail || "—"}</p>
            <p>First call: {client.firstCallCompleted ? "Completed" : "Pending"}</p>
            <p>Assigned: {assigned.join(", ") || "—"}</p>
            <p>Deal value: {client.estimatedDealValue ?? "—"}</p>
            <p>Updated: {formatDateTime(client.updatedAt)}</p>
            {CUSTOM_FIELDS.filter((f) => f.showOnLeadDetails).map((f) => (
              <p key={f.id}>
                {f.label}: {String(client.customFields?.[f.key] ?? "—")}
              </p>
            ))}
            {!client.firstCallCompleted ? (
              <Button
                onClick={() => {
                  if (!session) return;
                  markFirstCallComplete(
                    client.id,
                    { firstCallNotes: "Completed from lead details" },
                    session.teamMemberId
                  );
                  setTick((t) => t + 1);
                  push("First call marked complete");
                }}
              >
                Mark first call complete
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => {
                setPendingDeal((client.estimatedDealValue ?? 0) + 5000);
                setDealReasonOpen(true);
              }}
            >
              Increase deal value (+5000)
            </Button>
          </div>
        ) : null}

        {tab === "Contacts" ? (
          <ul className="space-y-2">
            {contacts
              .filter((c) => c.clientId === client.id)
              .map((c) => (
                <li key={c.id}>
                  {c.name} · {c.designation} · {c.primaryPhone}
                </li>
              ))}
          </ul>
        ) : null}

        {tab === "Calls" ? (
          <ul className="space-y-2">
            {calls
              .filter((c) => c.clientId === client.id)
              .map((c) => (
                <li key={c.id}>
                  {formatDateTime(c.callDatetime)} · {c.outcome} · {c.discussionNotes}
                </li>
              ))}
          </ul>
        ) : null}

        {tab === "Comments" ? (
          <div className="space-y-3">
            {comments
              .filter((c) => c.clientId === client.id)
              .map((c) => (
                <div key={c.id} className="rounded-md border p-3">
                  <p>{c.body}</p>
                  <p className="mt-1 text-xs text-stone-500">{formatDateTime(c.createdAt)}</p>
                </div>
              ))}
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add comment" />
            <Button
              onClick={() => {
                if (!comment.trim() || !session) return;
                comments.unshift({
                  id: `cm-${Date.now()}`,
                  clientId: client.id,
                  authorId: session.teamMemberId,
                  body: comment.trim(),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
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

        {tab === "Activity" ? (
          <ul className="space-y-2 text-sm">
            {activities
              .filter((a) => a.clientId === client.id)
              .map((a) => (
                <li key={a.id}>
                  {a.action} {a.reason ? `· ${a.reason}` : ""} · {formatDateTime(a.timestamp)}
                </li>
              ))}
          </ul>
        ) : null}

        {tab === "Tasks" ? (
          <ul className="space-y-2">
            {tasks
              .filter((t) => t.clientId === client.id)
              .map((t) => (
                <li key={t.id}>
                  {t.title} · {t.status} · {t.priority}
                </li>
              ))}
          </ul>
        ) : null}

        {tab === "Meetings" ? (
          <ul className="space-y-2">
            {meetings
              .filter((m) => m.clientId === client.id)
              .map((m) => (
                <li key={m.id}>
                  {m.title} · {formatDate(m.meetingDate)} · {m.status}
                </li>
              ))}
          </ul>
        ) : null}

        {tab === "Files" ? (
          <ul className="space-y-2">
            {attachments
              .filter((a) => a.clientId === client.id)
              .map((a) => (
                <li key={a.id}>
                  {a.originalFilename} · {(a.fileSize / 1024).toFixed(1)} KB
                </li>
              ))}
            {followups.filter((f) => f.clientId === client.id).length ? (
              <p className="pt-2 text-xs text-stone-500">
                Follow-ups linked: {followups.filter((f) => f.clientId === client.id).length}
              </p>
            ) : null}
          </ul>
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
          router.push("/leads");
        }}
      />
      <ReasonDialog
        open={dealReasonOpen}
        title="Change deal value"
        description="Pricing/deal-value changes require a reason."
        onClose={() => setDealReasonOpen(false)}
        onConfirm={(reason) => {
          if (!session || pendingDeal == null) return;
          updateClient(client.id, { estimatedDealValue: pendingDeal }, session.teamMemberId, reason);
          setTick((t) => t + 1);
          setDealReasonOpen(false);
          push("Deal value updated");
        }}
      />
    </div>
  );
}
