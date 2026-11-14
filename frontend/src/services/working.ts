import { apiRequest } from "@/lib/api";
import { cacheGet, cacheInvalidate, cacheSet } from "@/lib/api-cache";
import { notifyDataChanged } from "@/lib/data-events";
import { invalidateActivityCache } from "@/services/activity";
import type { LeadWorking } from "@/types";

type ApiWorking = {
  id: string;
  client: string;
  team_member: string;
  member_name: string;
  job_title?: string;
  work_note: string;
  assigned_by?: string | null;
  assigned_by_name?: string | null;
  updated_by?: string | null;
  updated_by_name?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkingRow = LeadWorking & {
  memberName: string;
  assignedByName?: string;
  updatedByName?: string;
};

export function mapWorking(row: ApiWorking): WorkingRow {
  return {
    id: String(row.id),
    clientId: String(row.client),
    teamMemberId: String(row.team_member),
    workNote: row.work_note || "",
    assignedById: row.assigned_by ? String(row.assigned_by) : "",
    assignedAt: row.created_at,
    updatedById: row.updated_by ? String(row.updated_by) : undefined,
    updatedAt: row.updated_at,
    isActive: Boolean(row.is_active),
    memberName: row.member_name,
    assignedByName: row.assigned_by_name || undefined,
    updatedByName: row.updated_by_name || undefined,
  };
}

function workingKey(clientId: string) {
  return `working:client:${clientId}`;
}

export function invalidateWorkingCache(clientId?: string) {
  if (clientId) cacheInvalidate(workingKey(clientId));
  else cacheInvalidate("working:");
}

export async function fetchWorkingForClient(
  clientId: string,
  signal?: AbortSignal,
  opts?: { force?: boolean }
) {
  const key = workingKey(clientId);
  if (!opts?.force) {
    const cached = cacheGet<WorkingRow[]>(key);
    if (cached) return cached;
  }
  const rows = await apiRequest<ApiWorking[]>("/api/assignments/working/", {
    query: { client: clientId },
    signal,
  });
  const mapped = (rows || []).map(mapWorking);
  cacheSet(key, mapped);
  return mapped;
}

export async function assignWorking(body: {
  client: string;
  team_member: string;
  work_note: string;
}) {
  const row = await apiRequest<ApiWorking>("/api/assignments/working/", {
    method: "POST",
    body,
  });
  invalidateWorkingCache(body.client);
  invalidateActivityCache();
  notifyDataChanged();
  return mapWorking(row);
}

export async function updateWorking(
  workingId: string,
  body: { team_member?: string; work_note?: string; reason: string },
  clientId?: string
) {
  const row = await apiRequest<ApiWorking>(`/api/assignments/working/${workingId}/`, {
    method: "PATCH",
    body,
  });
  invalidateWorkingCache(clientId || String(row.client));
  invalidateActivityCache();
  notifyDataChanged();
  return mapWorking(row);
}

export async function removeWorking(workingId: string, reason: string, clientId?: string) {
  await apiRequest(`/api/assignments/working/${workingId}/`, {
    method: "DELETE",
    body: { reason },
  });
  if (clientId) invalidateWorkingCache(clientId);
  else invalidateWorkingCache();
  invalidateActivityCache();
  notifyDataChanged();
}
