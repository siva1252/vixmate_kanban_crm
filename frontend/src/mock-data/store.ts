import type {
  ActivityRecord,
  AttachmentRecord,
  CallRecord,
  Client,
  CommentRecord,
  ContactPerson,
  CustomFieldDefinition,
  FollowUpRecord,
  LeadAssignment,
  LeadSource,
  LeadSourceLink,
  LeadSourcePerson,
  LeadStage,
  LeadWorking,
  MeetingRecord,
  ResponsibilityType,
  ServiceOption,
  TaskRecord,
  TeamMember,
} from "@/types";

export const COLUMN_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f97316",
  "#ef4444",
  "#14b8a6",
  "#a855f7",
  "#eab308",
  "#ec4899",
  "#64748b",
  "#0f766e",
  "#2563eb",
] as const;

export let STAGES: LeadStage[] = [
  { id: "st-1", name: "New Lead", slug: "new-lead", displayOrder: 1, isTerminal: false, color: "#3b82f6" },
  { id: "st-2", name: "Call Back", slug: "call-back", displayOrder: 2, isTerminal: false, color: "#f97316" },
  { id: "st-3", name: "In Progress", slug: "in-progress", displayOrder: 3, isTerminal: false, color: "#14b8a6" },
  { id: "st-4", name: "Qualified", slug: "qualified", displayOrder: 4, isTerminal: false, color: "#22c55e" },
  { id: "st-5", name: "Meeting", slug: "meeting", displayOrder: 5, isTerminal: false, color: "#a855f7" },
  { id: "st-6", name: "Negotiation", slug: "negotiation", displayOrder: 6, isTerminal: false, color: "#eab308" },
  { id: "st-7", name: "Loss", slug: "loss", displayOrder: 7, isTerminal: true, color: "#ef4444" },
  { id: "st-8", name: "Won", slug: "won", displayOrder: 8, isTerminal: true, color: "#0f766e" },
];

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "column";
}

function reindexStages() {
  STAGES = [...STAGES]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((s, i) => ({ ...s, displayOrder: i + 1 }));
}

export function sortedStages() {
  return [...STAGES].sort((a, b) => a.displayOrder - b.displayOrder);
}

export function addStage(name: string, color: string, actorId: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Column name is required");
  if (STAGES.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error("A column with this name already exists");
  }
  const stage: LeadStage = {
    id: uid("st"),
    name: trimmed,
    slug: slugify(trimmed),
    displayOrder: STAGES.length + 1,
    isTerminal: false,
    color,
  };
  STAGES.push(stage);
  reindexStages();
  pushActivity({
    actorId,
    action: "column_created",
    entityType: "LeadStage",
    entityId: stage.id,
    newValues: { name: stage.name, color: stage.color },
  });
  return stage;
}

export function updateStage(
  id: string,
  patch: { name?: string; color?: string; isTerminal?: boolean },
  actorId: string
) {
  const idx = STAGES.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error("Column not found");
  const current = STAGES[idx];
  const nextName = patch.name?.trim() ?? current.name;
  if (!nextName) throw new Error("Column name is required");
  if (STAGES.some((s) => s.id !== id && s.name.toLowerCase() === nextName.toLowerCase())) {
    throw new Error("A column with this name already exists");
  }
  const updated: LeadStage = {
    ...current,
    name: nextName,
    slug: patch.name ? slugify(nextName) : current.slug,
    color: patch.color ?? current.color,
    isTerminal: patch.isTerminal ?? current.isTerminal,
  };
  STAGES[idx] = updated;
  pushActivity({
    actorId,
    action: "column_updated",
    entityType: "LeadStage",
    entityId: id,
    oldValues: { name: current.name, color: current.color },
    newValues: { name: updated.name, color: updated.color },
  });
  return updated;
}

export function reorderStages(orderedIds: string[], actorId: string) {
  const map = new Map(STAGES.map((s) => [s.id, s]));
  const next: LeadStage[] = [];
  orderedIds.forEach((id, i) => {
    const stage = map.get(id);
    if (stage) next.push({ ...stage, displayOrder: i + 1 });
  });
  for (const stage of STAGES) {
    if (!orderedIds.includes(stage.id)) {
      next.push({ ...stage, displayOrder: next.length + 1 });
    }
  }
  STAGES = next;
  pushActivity({
    actorId,
    action: "column_reordered",
    entityType: "LeadStage",
    entityId: "board",
    newValues: { order: STAGES.map((s) => s.name).join(" → ") },
  });
  return STAGES;
}

export function deleteStage(id: string, actorId: string, reason: string) {
  if (!reason || reason.trim().length < 3) {
    throw new Error("A reason is required to delete a column");
  }
  if (STAGES.length <= 1) throw new Error("At least one column is required");
  const idx = STAGES.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error("Column not found");
  const [removed] = STAGES.splice(idx, 1);
  reindexStages();
  const fallback = STAGES[0];
  let moved = 0;
  clients = clients.map((c) => {
    if (c.stageId !== id) return c;
    moved += 1;
    return { ...c, stageId: fallback.id, updatedAt: new Date().toISOString() };
  });
  pushActivity({
    actorId,
    action: "column_deleted",
    entityType: "LeadStage",
    entityId: id,
    reason: reason.trim(),
    oldValues: { name: removed.name, color: removed.color },
    newValues: {
      movedLeads: moved,
      fallbackColumn: fallback.name,
    },
  });
  return { removed, moved, fallback };
}

export const LEAD_SOURCES: LeadSource[] = [
  { id: "src-1", name: "LinkedIn", slug: "linkedin", allowsOtherText: false },
  { id: "src-2", name: "Instagram", slug: "instagram", allowsOtherText: false },
  { id: "src-3", name: "Facebook", slug: "facebook", allowsOtherText: false },
  { id: "src-4", name: "Google", slug: "google", allowsOtherText: false },
  { id: "src-5", name: "Referral", slug: "referral", allowsOtherText: false },
  { id: "src-6", name: "Cold Calling", slug: "cold-calling", allowsOtherText: false },
  { id: "src-7", name: "Email", slug: "email", allowsOtherText: false },
  { id: "src-8", name: "Website Inquiry", slug: "website-inquiry", allowsOtherText: false },
  { id: "src-9", name: "Other", slug: "other", allowsOtherText: true },
];

export const SERVICES: ServiceOption[] = [
  { id: "svc-1", name: "App Development", slug: "app-development", allowsOtherText: false },
  { id: "svc-2", name: "E-commerce", slug: "e-commerce", allowsOtherText: false },
  { id: "svc-3", name: "Automation", slug: "automation", allowsOtherText: false },
  { id: "svc-4", name: "Social Media", slug: "social-media", allowsOtherText: false },
  { id: "svc-5", name: "AI/ML Solutions", slug: "aiml-solutions", allowsOtherText: false },
  { id: "svc-6", name: "Web Development", slug: "web-development", allowsOtherText: false },
  { id: "svc-7", name: "Digital Marketing", slug: "digital-marketing", allowsOtherText: false },
  { id: "svc-8", name: "Other", slug: "other", allowsOtherText: true },
];

export const RESPONSIBILITIES: ResponsibilityType[] = [
  { id: "resp-1", name: "Lead Creation", slug: "lead-creation", displayOrder: 1 },
  { id: "resp-2", name: "Technical Management", slug: "technical-management", displayOrder: 2 },
  { id: "resp-3", name: "Meetings", slug: "meetings", displayOrder: 3 },
  { id: "resp-4", name: "Communication", slug: "communication", displayOrder: 4 },
  { id: "resp-5", name: "Follow-up", slug: "follow-up", displayOrder: 5 },
];

/** Team members come from `/api/team/` — no fake local roster. */
export const TEAM: TeamMember[] = [];

/** External Lead Source people — loaded from API; no seed fixtures. */
export const leadSourcePeople: LeadSourcePerson[] = [];

export const leadSourceLinks: LeadSourceLink[] = [];

export function linksForPerson(personId: string) {
  return leadSourceLinks.filter((l) => l.personId === personId && l.isActive);
}

export function linksForClient(clientId: string) {
  return leadSourceLinks.filter((l) => l.clientId === clientId && l.isActive);
}

export function peopleForClient(clientId: string) {
  const ids = new Set(linksForClient(clientId).map((l) => l.personId));
  return leadSourcePeople.filter((p) => ids.has(p.id));
}

export const CUSTOM_FIELDS: CustomFieldDefinition[] = [
  {
    id: "cf-2",
    label: "Budget confirmed",
    key: "budget_confirmed",
    fieldType: "boolean",
    isRequired: false,
    showOnInitialForm: false,
    showOnPostFirstCall: true,
    showOnLeadDetails: true,
  },
];

/** CRM records start empty — create real leads in the app / API. */
export let clients: Client[] = [];
export const assignments: LeadAssignment[] = [];
export const working: LeadWorking[] = [];
export const contacts: ContactPerson[] = [];
export const calls: CallRecord[] = [];
export const comments: CommentRecord[] = [];
export const tasks: TaskRecord[] = [];
export const meetings: MeetingRecord[] = [];
export const followups: FollowUpRecord[] = [];
export const attachments: AttachmentRecord[] = [];
export let activities: ActivityRecord[] = [];

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function touchClient(clientId: string) {
  clients = clients.map((c) =>
    c.id === clientId ? { ...c, updatedAt: new Date().toISOString() } : c
  );
}

export function pushActivity(entry: Omit<ActivityRecord, "id" | "timestamp">) {
  activities = [
    {
      id: uid("ac"),
      timestamp: new Date().toISOString(),
      ...entry,
    },
    ...activities,
  ];
}
