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

export const TEAM: TeamMember[] = [
  {
    id: "tm-1",
    displayName: "Siva",
    email: "siva@viximate.local",
    jobTitle: "Admin",
    availabilityStatus: "available",
    isActive: true,
  },
  {
    id: "tm-2",
    displayName: "Krishna",
    email: "krishna@viximate.local",
    jobTitle: "Admin",
    availabilityStatus: "busy",
    isActive: true,
  },
  {
    id: "tm-3",
    displayName: "Rahul",
    email: "rahul@viximate.local",
    jobTitle: "Admin",
    availabilityStatus: "available",
    isActive: true,
  },
];

/** External people — Lead Source tab (no CRM access) */
export let leadSourcePeople: LeadSourcePerson[] = [
  {
    id: "lsp-1",
    displayName: "Ravi Agency",
    phone: "9800010001",
    email: "ravi@agency.example",
    roleLabel: "Agency contact",
    notes: "Brings retail leads; no CRM access.",
    isActive: true,
  },
  {
    id: "lsp-2",
    displayName: "Meena Introducer",
    phone: "9800010002",
    email: "meena@intro.example",
    roleLabel: "Introducer",
    notes: "Referral partner — track attributed leads only.",
    isActive: true,
  },
];

export let leadSourceLinks: LeadSourceLink[] = [];

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

const now = new Date().toISOString();

export let clients: Client[] = [
  {
    id: "cl-1",
    clientName: "Northwind Retail",
    primaryPhone: "9876500001",
    primaryEmail: "ops@northwind.test",
    leadSourceId: "src-1",
    serviceId: "svc-6",
    stageId: "st-1",
    firstCallCompleted: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "cl-2",
    clientName: "Bright Labs",
    primaryPhone: "9876500002",
    primaryEmail: "hello@brightlabs.test",
    leadSourceId: "src-5",
    serviceId: "svc-5",
    stageId: "st-4",
    firstCallCompleted: true,
    firstCallNotes: "Interested in ML automation",
    estimatedDealValue: 85000,
    decisionMakerPhone: "9876500099",
    decisionMakerEmail: "ceo@brightlabs.test",
    companyName: "Bright Labs Pvt Ltd",
    createdAt: now,
    updatedAt: now,
    customFields: { budget_confirmed: true },
  },
  {
    id: "cl-3",
    clientName: "Cedar Health",
    primaryPhone: "9876500003",
    leadSourceId: "src-8",
    serviceId: "svc-1",
    stageId: "st-5",
    firstCallCompleted: true,
    estimatedDealValue: 120000,
    createdAt: now,
    updatedAt: now,
  },
];

leadSourceLinks = [
  { id: "lsl-1", clientId: "cl-1", personId: "lsp-1", note: "Introduced", isActive: true },
  { id: "lsl-2", clientId: "cl-1", personId: "lsp-2", note: "Co-sourced", isActive: true },
  { id: "lsl-3", clientId: "cl-2", personId: "lsp-1", isActive: true },
  { id: "lsl-4", clientId: "cl-3", personId: "lsp-2", isActive: true },
];

export const assignments: LeadAssignment[] = [
  {
    id: "as-1",
    clientId: "cl-2",
    responsibilityTypeId: "resp-1",
    teamMemberId: "tm-1",
    isActive: true,
  },
  {
    id: "as-2",
    clientId: "cl-2",
    responsibilityTypeId: "resp-2",
    teamMemberId: "tm-2",
    isActive: true,
  },
  {
    id: "as-3",
    clientId: "cl-2",
    responsibilityTypeId: "resp-3",
    teamMemberId: "tm-1",
    isActive: true,
  },
  {
    id: "as-4",
    clientId: "cl-2",
    responsibilityTypeId: "resp-3",
    teamMemberId: "tm-2",
    isActive: true,
  },
];

export let working: LeadWorking[] = [
  {
    id: "wk-1",
    clientId: "cl-2",
    teamMemberId: "tm-1",
    workNote: "Preparing technical proposal and scope for AI/ML pipeline",
    assignedById: "tm-3",
    assignedAt: now,
    updatedAt: now,
    isActive: true,
  },
  {
    id: "wk-2",
    clientId: "cl-2",
    teamMemberId: "tm-2",
    workNote: "Client communication and follow-up scheduling",
    assignedById: "tm-1",
    assignedAt: now,
    updatedAt: now,
    isActive: true,
  },
  {
    id: "wk-3",
    clientId: "cl-3",
    teamMemberId: "tm-1",
    workNote: "Drafting meeting agenda for product demo",
    assignedById: "tm-2",
    assignedAt: now,
    updatedAt: now,
    isActive: true,
  },
];

export const contacts: ContactPerson[] = [
  {
    id: "ct-1",
    clientId: "cl-2",
    name: "Ananya Rao",
    designation: "Operations Head",
    primaryPhone: "9876501111",
    primaryEmail: "ananya@brightlabs.test",
  },
];

export const calls: CallRecord[] = [
  {
    id: "ca-1",
    clientId: "cl-2",
    callDatetime: now,
    calledById: "tm-1",
    outcome: "connected",
    discussionNotes: "Qualified interest in AI/ML",
    isFirstCall: true,
    followUpDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
  },
];

export const comments: CommentRecord[] = [
  {
    id: "cm-1",
    clientId: "cl-2",
    authorId: "tm-1",
    body: "Shared proposal draft with technical team.",
    createdAt: now,
    updatedAt: now,
  },
];

export const tasks: TaskRecord[] = [
  {
    id: "tk-1",
    clientId: "cl-2",
    title: "Prepare technical scope",
    description: "Draft scope for ML pipeline",
    assignedToId: "tm-2",
    createdById: "tm-1",
    dueDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
    priority: "high",
    status: "in_progress",
  },
  {
    id: "tk-2",
    clientId: "cl-3",
    title: "Send meeting agenda",
    description: "",
    assignedToId: "tm-1",
    createdById: "tm-3",
    priority: "medium",
    status: "pending",
  },
];

export const meetings: MeetingRecord[] = [
  {
    id: "mt-1",
    clientId: "cl-3",
    title: "Discovery workshop",
    meetingDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    startTime: "11:00",
    endTime: "12:00",
    coordinatorId: "tm-1",
    participantIds: ["tm-1", "tm-2"],
    meetingType: "online",
    meetingLink: "https://meet.example.com/cedar",
    agenda: "Requirements walkthrough",
    status: "scheduled",
  },
];

export const followups: FollowUpRecord[] = [
  {
    id: "fu-1",
    clientId: "cl-2",
    followUpDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    updatedById: "tm-1",
    callOutcome: "connected",
    notes: "Awaiting budget confirmation",
    nextAction: "Call decision maker",
    status: "pending",
  },
];

export const attachments: AttachmentRecord[] = [
  {
    id: "at-1",
    clientId: "cl-2",
    originalFilename: "proposal-draft.pdf",
    documentType: "proposal",
    title: "ML automation proposal",
    description: "First draft shared with technical team",
    fileType: "application/pdf",
    fileSize: 245760,
    uploadedById: "tm-1",
    uploadedAt: now,
  },
];

export let activities: ActivityRecord[] = [
  {
    id: "ac-1",
    actorId: "tm-1",
    action: "client_created",
    entityType: "Client",
    entityId: "cl-1",
    clientId: "cl-1",
    newValues: {
      clientName: "Northwind Retail",
      primaryPhone: "9876500001",
      primaryEmail: "ops@northwind.test",
      stage: "New Lead",
    },
    timestamp: now,
  },
  {
    id: "ac-2",
    actorId: "tm-1",
    action: "stage_changed",
    entityType: "Client",
    entityId: "cl-2",
    clientId: "cl-2",
    oldValues: { stage: "In Progress" },
    newValues: { stage: "Qualified" },
    timestamp: now,
  },
  {
    id: "ac-3",
    actorId: "tm-3",
    action: "working_assigned",
    entityType: "LeadWorking",
    entityId: "wk-1",
    clientId: "cl-2",
    newValues: {
      teamMemberName: "Siva",
      workNote: "Preparing technical proposal and scope for AI/ML pipeline",
    },
    timestamp: now,
  },
  {
    id: "ac-4",
    actorId: "tm-1",
    action: "working_assigned",
    entityType: "LeadWorking",
    entityId: "wk-2",
    clientId: "cl-2",
    newValues: {
      teamMemberName: "Krishna",
      workNote: "Client communication and follow-up scheduling",
    },
    timestamp: now,
  },
  {
    id: "ac-5",
    actorId: "tm-1",
    action: "attachment_uploaded",
    entityType: "Attachment",
    entityId: "at-1",
    clientId: "cl-2",
    newValues: {
      title: "ML automation proposal",
      documentType: "proposal",
      filename: "proposal-draft.pdf",
    },
    timestamp: now,
  },
  {
    id: "ac-6",
    actorId: "tm-1",
    action: "comment_added",
    entityType: "Comment",
    entityId: "cm-1",
    clientId: "cl-2",
    newValues: { body: "Shared proposal draft with technical team." },
    timestamp: now,
  },
  {
    id: "ac-7",
    actorId: "tm-1",
    action: "followup_scheduled",
    entityType: "FollowUp",
    entityId: "fu-1",
    clientId: "cl-2",
    newValues: {
      followUpDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
      notes: "Awaiting budget confirmation",
    },
    timestamp: now,
  },
  {
    id: "ac-8",
    actorId: "tm-2",
    action: "client_created",
    entityType: "Client",
    entityId: "cl-2",
    clientId: "cl-2",
    newValues: {
      clientName: "Bright Labs",
      primaryPhone: "9876500002",
      stage: "Qualified",
    },
    timestamp: now,
  },
  {
    id: "ac-9",
    actorId: "tm-1",
    action: "client_updated",
    entityType: "Client",
    entityId: "cl-3",
    clientId: "cl-3",
    reason: "Corrected phone after first call",
    oldValues: { primaryPhone: "9876500000" },
    newValues: { primaryPhone: "9876500003" },
    timestamp: now,
  },
];

export const MOCK_PASSWORD = "MemberPass123!";

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
