export const ACTIVITY_ACTIONS = [
  { value: "login", label: "Signed in" },
  { value: "login_failed", label: "Login failed" },
  { value: "logout", label: "Signed out" },
  { value: "otp_sent", label: "OTP sent" },
  { value: "password_reset", label: "Password reset" },
  { value: "password_changed", label: "Password changed" },
  { value: "user_created", label: "Team user created" },
  { value: "client_created", label: "Lead created" },
  { value: "client_updated", label: "Lead details edited" },
  { value: "client_deleted", label: "Lead deleted" },
  { value: "stage_changed", label: "Lead dragged / stage moved" },
  { value: "attachment_uploaded", label: "Document uploaded" },
  { value: "attachment_updated", label: "Document edited" },
  { value: "attachment_deleted", label: "Document deleted" },
  { value: "working_assigned", label: "Team member assigned (working)" },
  { value: "working_updated", label: "Working assignment edited" },
  { value: "working_removed", label: "Working assignment removed" },
  { value: "assignment_reassigned", label: "Responsibility reassigned" },
  { value: "comment_added", label: "Comment added" },
  { value: "followup_scheduled", label: "Follow-up scheduled" },
  { value: "call_logged", label: "Call logged" },
  { value: "column_created", label: "Column added" },
  { value: "column_updated", label: "Column edited" },
  { value: "column_deleted", label: "Column deleted" },
  { value: "column_reordered", label: "Columns reordered" },
  { value: "lead_source_person_created", label: "Lead Source person created" },
  { value: "lead_source_person_updated", label: "Lead Source person updated" },
  { value: "lead_source_person_activated", label: "Lead Source person activated" },
  { value: "lead_source_person_deactivated", label: "Lead Source person deactivated" },
  { value: "lead_source_assigned", label: "Lead Source person linked to lead" },
  { value: "lead_source_unassigned", label: "Lead Source person unlinked" },
] as const;

export const ACTIVITY_ENTITIES = [
  { value: "Client", label: "Lead / Client" },
  { value: "Attachment", label: "Document" },
  { value: "LeadWorking", label: "Working" },
  { value: "LeadAssignment", label: "Assignment" },
  { value: "Comment", label: "Comment" },
  { value: "FollowUp", label: "Follow-up" },
  { value: "Call", label: "Call" },
  { value: "LeadStage", label: "Board column" },
  { value: "LeadSourcePerson", label: "Lead Source person" },
  { value: "LeadSourceLink", label: "Lead Source link" },
] as const;

const FIELD_LABELS: Record<string, string> = {
  clientName: "Client name",
  primaryPhone: "Primary phone",
  alternatePhone: "Alternate phone",
  primaryEmail: "Primary email",
  alternateEmail: "Alternate email",
  leadSourceId: "Channel source",
  leadSourceOther: "Other channel source",
  serviceId: "Service",
  serviceOther: "Other service",
  stageId: "Stage",
  firstCallCompleted: "First call completed",
  clientRequirements: "Client requirements",
  firstCallNotes: "First call notes",
  callDiscussionNotes: "Call discussion notes",
  decisionMakerPhone: "Decision-maker phone",
  decisionMakerEmail: "Decision-maker email",
  estimatedDealValue: "Budget / deal value",
  nextFollowUpDate: "Follow-up date",
  customFields: "Custom fields",
  teamMemberId: "Team member",
  teamMemberName: "Team member",
  workNote: "Work note",
  title: "Document name",
  documentType: "Document type",
  filename: "Filename",
  archived: "Archived",
  isActive: "Active",
  stage: "Stage",
  member: "Team member",
  body: "Comment",
  followUpDate: "Follow-up date",
  notes: "Notes",
  name: "Name",
  displayName: "Name",
  roleLabel: "Role",
  phone: "Phone",
  email: "Email",
  personName: "Lead Source person",
  note: "Note",
  color: "Color",
  order: "Order",
  movedLeads: "Leads moved",
  fallbackColumn: "Moved to column",
};

/** Reason is shown for edit / delete / remove / reassign / deactivate style actions. */
export function actionNeedsReason(action: string) {
  return /_(updated|deleted|reassigned|removed|deactivated|unassigned)$/.test(action);
}

export function actionLabel(action: string) {
  return ACTIVITY_ACTIONS.find((a) => a.value === action)?.label ?? action.replaceAll("_", " ");
}

export function entityLabel(entityType: string) {
  return ACTIVITY_ENTITIES.find((e) => e.value === entityType)?.label ?? entityType;
}

export function fieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key.replaceAll("_", " ");
}

function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

const DELETE_STYLE = /_(deleted|removed|deactivated|unassigned)$/;

/** Human-readable summary of old → new values for logs. */
export function formatChangeSummary(
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>,
  action?: string
): string[] {
  // Delete / remove style actions: show only the user action, not every cleared field.
  if (action && DELETE_STYLE.test(action)) {
    const name =
      (typeof oldValues?.client_name === "string" && oldValues.client_name) ||
      (typeof oldValues?.clientName === "string" && oldValues.clientName) ||
      (typeof oldValues?.display_name === "string" && oldValues.display_name) ||
      (typeof oldValues?.displayName === "string" && oldValues.displayName) ||
      (typeof oldValues?.name === "string" && oldValues.name) ||
      null;
    if (action === "client_deleted") {
      return name ? [`Deleted lead “${name}”`] : ["Lead deleted"];
    }
    if (name) return [`Removed “${name}”`];
    if (newValues?.status != null) return [`Status: ${formatValue(newValues.status)}`];
    if (newValues?.is_deleted === true || newValues?.is_active === false) return ["Deactivated / removed"];
    return ["Removed"];
  }

  const keys = new Set([
    ...Object.keys(oldValues ?? {}),
    ...Object.keys(newValues ?? {}),
  ]);
  if (keys.size === 0) return [];

  const lines: string[] = [];
  for (const key of keys) {
    const before = oldValues?.[key];
    const after = newValues?.[key];
    if (JSON.stringify(before) === JSON.stringify(after)) continue;

    // Prefer friendly names when both id + name are present
    if (key === "teamMemberId" && (oldValues?.teamMemberName || newValues?.teamMemberName)) {
      continue;
    }
    if (key.endsWith("Id") && (oldValues?.[key.replace(/Id$/, "Name")] || newValues?.[key.replace(/Id$/, "Name")])) {
      continue;
    }

    // Skip empty create noise (—, blank, false-y placeholders)
    const isEmpty = (v: unknown) =>
      v == null || v === "" || v === false || (typeof v === "string" && !v.trim());

    const label = fieldLabel(key);
    if (before !== undefined && after !== undefined) {
      lines.push(`${label}: ${formatValue(before)} → ${formatValue(after)}`);
    } else if (after !== undefined) {
      if (isEmpty(after) && !(typeof after === "boolean")) continue;
      if (after === false && key.includes("first_call")) {
        // still useful to show first call = No on create? skip — default state
        continue;
      }
      lines.push(`${label}: ${formatValue(after)}`);
    } else {
      // Skip one-sided "removed" dumps from legacy delete snapshots
      continue;
    }
  }
  return lines;
}
