import { apiRequest } from "@/lib/api";
import { cacheGet, cacheInvalidate, cacheSet } from "@/lib/api-cache";
import { notifyDataChanged } from "@/lib/data-events";
import type { LeadSourcePerson } from "@/types";

type ApiPerson = {
  id: string;
  display_name: string;
  phone?: string;
  email?: string;
  role_label?: string;
  notes?: string;
  is_active: boolean;
  lead_count?: number;
};

type ApiAttribution = {
  id: string;
  client: string;
  client_name: string;
  person: string;
  person_name: string;
  stage_name?: string;
  note?: string;
  is_active: boolean;
};

export function mapPerson(row: ApiPerson): LeadSourcePerson & { leadCount?: number } {
  return {
    id: String(row.id),
    displayName: row.display_name,
    phone: row.phone || undefined,
    email: row.email || undefined,
    roleLabel: row.role_label || undefined,
    notes: row.notes || undefined,
    isActive: row.is_active,
    leadCount: row.lead_count,
  };
}

export async function fetchLeadSourcePeople(
  query: {
    search?: string;
    status?: string;
    has_leads?: string;
    client?: string;
    person?: string;
  } = {},
  signal?: AbortSignal,
  opts?: { force?: boolean }
) {
  const key = `lead-source:${query.search || ""}:${query.status || ""}:${query.has_leads || ""}:${query.client || ""}:${query.person || ""}`;
  if (!opts?.force) {
    const cached = cacheGet<Array<LeadSourcePerson & { leadCount?: number }>>(key);
    if (cached) return cached;
  }
  const rows = await apiRequest<ApiPerson[]>("/api/lead-source/", {
    query: {
      search: query.search,
      status: query.status,
      has_leads: query.has_leads,
      client: query.client,
      page_size: 100,
    },
    signal,
  });
  let people = (rows || []).map(mapPerson);
  if (query.person) people = people.filter((p) => p.id === query.person);
  cacheSet(key, people);
  return people;
}

export function invalidateLeadSourceCache() {
  cacheInvalidate("lead-source:");
  notifyDataChanged();
}

export async function createLeadSourcePerson(body: {
  display_name: string;
  phone?: string;
  email?: string;
  role_label?: string;
  notes?: string;
}) {
  const row = await apiRequest<ApiPerson>("/api/lead-source/", {
    method: "POST",
    body,
  });
  invalidateLeadSourceCache();
  return mapPerson(row);
}

export async function updateLeadSourcePerson(
  personId: string,
  body: Partial<{
    display_name: string;
    phone: string;
    email: string;
    role_label: string;
    notes: string;
    is_active: boolean;
    reason: string;
    unassign_leads: boolean;
  }>
) {
  const row = await apiRequest<ApiPerson>(`/api/lead-source/${personId}/`, {
    method: "PATCH",
    body,
  });
  invalidateLeadSourceCache();
  return mapPerson(row);
}

export async function assignPeopleToLead(body: {
  client: string;
  people: string[];
  note?: string;
}) {
  const rows = await apiRequest<ApiAttribution[]>("/api/lead-source/assign/", {
    method: "POST",
    body,
  });
  invalidateLeadSourceCache();
  return rows;
}

export async function unlinkAttribution(attributionId: string, reason: string) {
  const result = await apiRequest(`/api/lead-source/attributions/${attributionId}/`, {
    method: "DELETE",
    body: { reason },
  });
  invalidateLeadSourceCache();
  return result;
}

export type PersonLeadsPayload = {
  stats: { total: number; open: number; won: number; lost: number };
  attributions: ApiAttribution[];
};

export async function fetchPersonLeads(
  personId: string,
  signal?: AbortSignal
): Promise<PersonLeadsPayload> {
  const data = await apiRequest<{
    stats: { total_leads: number; open_leads: number; won: number; lost: number };
    attributions: ApiAttribution[];
  }>(`/api/lead-source/${personId}/`, { signal });
  return {
    stats: {
      total: data.stats?.total_leads ?? 0,
      open: data.stats?.open_leads ?? 0,
      won: data.stats?.won ?? 0,
      lost: data.stats?.lost ?? 0,
    },
    attributions: (data.attributions ?? []).filter((a) => a.is_active),
  };
}

export async function fetchClientsForAssign(signal?: AbortSignal) {
  return apiRequest<Array<{ id: string; client_name: string }>>("/api/clients/", {
    query: { page_size: 100 },
    signal,
  });
}
