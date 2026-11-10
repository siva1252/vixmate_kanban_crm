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
  LeadStage,
  MeetingRecord,
  ResponsibilityType,
  ServiceOption,
  TaskRecord,
  TeamMember,
} from "@/types";

export const STAGES: LeadStage[] = [
  { id: "st-1", name: "New Lead", slug: "new-lead", displayOrder: 1, isTerminal: false },
  { id: "st-2", name: "Call Back", slug: "call-back", displayOrder: 2, isTerminal: false },
  { id: "st-3", name: "In Progress", slug: "in-progress", displayOrder: 3, isTerminal: false },
  { id: "st-4", name: "Qualified", slug: "qualified", displayOrder: 4, isTerminal: false },
  { id: "st-5", name: "Meeting", slug: "meeting", displayOrder: 5, isTerminal: false },
  { id: "st-6", name: "Negotiation", slug: "negotiation", displayOrder: 6, isTerminal: false },
  { id: "st-7", name: "Loss", slug: "loss", displayOrder: 7, isTerminal: true },
  { id: "st-8", name: "Won", slug: "won", displayOrder: 8, isTerminal: true },
];

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
    jobTitle: "CRM Specialist",
    availabilityStatus: "available",
    isActive: true,
  },
  {
    id: "tm-2",
    displayName: "Krishna",
    email: "krishna@viximate.local",
    jobTitle: "Technical Specialist",
    availabilityStatus: "busy",
    isActive: true,
  },
  {
    id: "tm-3",
    displayName: "Rahul",
    email: "rahul@viximate.local",
    jobTitle: "Communications",
    availabilityStatus: "available",
    isActive: true,
  },
];

export const CUSTOM_FIELDS: CustomFieldDefinition[] = [
  {
    id: "cf-1",
    label: "Preferred contact window",
    key: "preferred_contact_window",
    fieldType: "dropdown",
    isRequired: false,
    choices: ["Morning", "Afternoon", "Evening"],
    showOnInitialForm: false,
    showOnPostFirstCall: true,
    showOnLeadDetails: true,
  },
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
    customFields: { preferred_contact_window: "Morning", budget_confirmed: true },
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
    timestamp: now,
  },
  {
    id: "ac-2",
    actorId: "tm-1",
    action: "stage_changed",
    entityType: "Client",
    entityId: "cl-2",
    clientId: "cl-2",
    oldValues: { stage: "in-progress" },
    newValues: { stage: "qualified" },
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
