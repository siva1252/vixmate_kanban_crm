export type LeadStageSlug = string;

export type AvailabilityStatus = "available" | "busy" | "on_leave";
export type TaskStatus = "pending" | "in_progress" | "blocked" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type MeetingStatus = "scheduled" | "completed" | "cancelled" | "rescheduled";
export type CallOutcome =
  | "connected"
  | "no_answer"
  | "busy"
  | "call_back_requested"
  | "not_interested"
  | "other";

export interface TeamMember {
  id: string;
  displayName: string;
  email: string;
  jobTitle: string;
  availabilityStatus: AvailabilityStatus;
  isActive: boolean;
}

/** Channel source (LinkedIn, Google, …) from configuration */
export interface LeadSource {
  id: string;
  name: string;
  slug: string;
  allowsOtherText: boolean;
}

/**
 * External Lead Source person — no CRM login.
 * UI tab: Lead Source. Distinct from channel LeadSource above.
 * Multiple people can be linked to one lead via LeadSourceLink.
 */
export interface LeadSourcePerson {
  id: string;
  displayName: string;
  phone?: string;
  email?: string;
  roleLabel?: string;
  notes?: string;
  isActive: boolean;
}

/** Many Lead Source people ↔ one lead */
export interface LeadSourceLink {
  id: string;
  clientId: string;
  personId: string;
  note?: string;
  isActive: boolean;
}

export interface ServiceOption {
  id: string;
  name: string;
  slug: string;
  allowsOtherText: boolean;
}

export interface LeadStage {
  id: string;
  name: string;
  slug: LeadStageSlug;
  displayOrder: number;
  isTerminal: boolean;
  /** Column accent color for board UI */
  color?: string;
}

export interface ResponsibilityType {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
}

export interface LeadAssignment {
  id: string;
  clientId: string;
  responsibilityTypeId: string;
  teamMemberId: string;
  isActive: boolean;
}

/** Who is working on a lead and what they are working on (note only). */
export interface LeadWorking {
  id: string;
  clientId: string;
  teamMemberId: string;
  workNote: string;
  assignedById: string;
  assignedAt: string;
  updatedById?: string;
  updatedAt: string;
  isActive: boolean;
}

export interface ContactPerson {
  id: string;
  clientId: string;
  name: string;
  designation: string;
  primaryPhone: string;
  alternatePhone?: string;
  primaryEmail?: string;
  alternateEmail?: string;
  notes?: string;
}

export interface CallRecord {
  id: string;
  clientId: string;
  callDatetime: string;
  durationSeconds?: number;
  calledById: string;
  outcome: CallOutcome;
  discussionNotes: string;
  nextAction?: string;
  followUpDate?: string;
  isFirstCall?: boolean;
}

export interface CommentRecord {
  id: string;
  clientId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  clientId: string;
  title: string;
  description: string;
  assignedToId?: string;
  createdById: string;
  startDate?: string;
  dueDate?: string;
  priority: TaskPriority;
  status: TaskStatus;
  completionNotes?: string;
}

export interface MeetingRecord {
  id: string;
  clientId: string;
  title: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  coordinatorId: string;
  participantIds: string[];
  meetingType: "online" | "offline";
  meetingLink?: string;
  location?: string;
  agenda?: string;
  status: MeetingStatus;
  outcome?: string;
  nextAction?: string;
}

export interface FollowUpRecord {
  id: string;
  clientId: string;
  followUpDate: string;
  updatedById: string;
  callOutcome?: CallOutcome;
  notes: string;
  nextAction?: string;
  status: "pending" | "completed" | "skipped";
}

export type AttachmentDocumentType =
  | "proposal"
  | "quotation"
  | "contract"
  | "nda"
  | "sow"
  | "requirement"
  | "brd"
  | "invoice"
  | "client_brief"
  | "other";

export interface AttachmentRecord {
  id: string;
  clientId: string;
  originalFilename: string;
  documentType: AttachmentDocumentType;
  documentTypeOther?: string;
  title: string;
  description?: string;
  fileType: string;
  fileSize: number;
  uploadedById: string;
  uploadedAt: string;
  /** Mock file payload so Open/Download can work locally */
  fileDataUrl?: string;
}

export interface ActivityRecord {
  id: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  clientId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason?: string;
  timestamp: string;
}

export interface CustomFieldDefinition {
  id: string;
  label: string;
  key: string;
  fieldType:
    | "text"
    | "textarea"
    | "number"
    | "decimal"
    | "date"
    | "datetime"
    | "dropdown"
    | "multi_select"
    | "checkbox"
    | "boolean"
    | "email"
    | "phone";
  isRequired: boolean;
  choices?: string[];
  showOnInitialForm: boolean;
  showOnPostFirstCall: boolean;
  showOnLeadDetails: boolean;
}

export interface Client {
  id: string;
  clientName: string;
  primaryPhone: string;
  alternatePhone?: string;
  primaryEmail?: string;
  alternateEmail?: string;
  leadSourceId: string;
  leadSourceOther?: string;
  serviceId: string;
  serviceOther?: string;
  stageId: string;
  firstCallCompleted: boolean;
  firstCallNotes?: string;
  decisionMakerPhone?: string;
  decisionMakerEmail?: string;
  estimatedDealValue?: number;
  clientRequirements?: string;
  nextFollowUpDate?: string;
  callDiscussionNotes?: string;
  companyName?: string;
  createdAt: string;
  updatedAt: string;
  customFields?: Record<string, unknown>;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  teamMemberId: string;
}
