import { apiRequest } from "@/lib/api";
import { cacheGet, cacheInvalidate, cacheSet } from "@/lib/api-cache";
import type { Client } from "@/types";
import { invalidateActivityCache } from "@/services/activity";

type ApiStage = { id: string; name?: string; slug?: string };

type ApiClient = {
  id: string;
  client_name: string;
  primary_phone: string;
  alternate_phone?: string;
  primary_email?: string;
  alternate_email?: string;
  lead_source: string;
  lead_source_other?: string;
  service: string;
  service_other?: string;
  stage: ApiStage | string;
  first_call_completed: boolean;
  first_call_notes?: string;
  decision_maker_phone?: string;
  decision_maker_email?: string;
  estimated_deal_value?: string | number | null;
  client_requirements?: string;
  next_follow_up_date?: string | null;
  call_discussion_notes?: string;
  company_name?: string;
  created_at: string;
  updated_at: string;
};

export type ClientFilters = {
  search?: string;
  stageId?: string;
  sourceId?: string;
  serviceId?: string;
  dateFrom?: string;
  dateTo?: string;
  firstCallCompleted?: boolean;
  page_size?: number;
};

export type CreateClientInput = {
  clientName: string;
  primaryPhone: string;
  alternatePhone?: string;
  primaryEmail?: string;
  alternateEmail?: string;
  leadSourceId: string;
  leadSourceOther?: string;
  serviceId: string;
  serviceOther?: string;
  firstCallCompleted?: boolean;
  decisionMakerPhone?: string;
  decisionMakerEmail?: string;
  estimatedDealValue?: number;
  clientRequirements?: string;
  callDiscussionNotes?: string;
  firstCallNotes?: string;
  companyName?: string;
  nextFollowUpDate?: string;
};

export type UpdateClientInput = Partial<CreateClientInput> & {
  stageId?: string;
};

function stageIdOf(stage: ApiClient["stage"]) {
  if (!stage) return "";
  if (typeof stage === "string") return stage;
  return String(stage.id);
}

export function mapClient(row: ApiClient): Client {
  const deal = row.estimated_deal_value;
  return {
    id: String(row.id),
    clientName: row.client_name,
    primaryPhone: row.primary_phone || "",
    alternatePhone: row.alternate_phone || undefined,
    primaryEmail: row.primary_email || undefined,
    alternateEmail: row.alternate_email || undefined,
    leadSourceId: String(row.lead_source),
    leadSourceOther: row.lead_source_other || undefined,
    serviceId: String(row.service),
    serviceOther: row.service_other || undefined,
    stageId: stageIdOf(row.stage),
    firstCallCompleted: Boolean(row.first_call_completed),
    firstCallNotes: row.first_call_notes || undefined,
    decisionMakerPhone: row.decision_maker_phone || undefined,
    decisionMakerEmail: row.decision_maker_email || undefined,
    estimatedDealValue:
      deal === null || deal === undefined || deal === "" ? undefined : Number(deal),
    clientRequirements: row.client_requirements || undefined,
    nextFollowUpDate: row.next_follow_up_date || undefined,
    callDiscussionNotes: row.call_discussion_notes || undefined,
    companyName: row.company_name || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCreateBody(input: CreateClientInput) {
  return {
    client_name: input.clientName,
    primary_phone: input.primaryPhone,
    alternate_phone: input.alternatePhone || "",
    primary_email: input.primaryEmail || "",
    alternate_email: input.alternateEmail || "",
    lead_source: input.leadSourceId,
    lead_source_other: input.leadSourceOther || "",
    service: input.serviceId,
    service_other: input.serviceOther || "",
    first_call_completed: Boolean(input.firstCallCompleted),
    decision_maker_phone: input.decisionMakerPhone || "",
    decision_maker_email: input.decisionMakerEmail || "",
    estimated_deal_value: input.estimatedDealValue ?? null,
    client_requirements: input.clientRequirements || "",
    call_discussion_notes: input.callDiscussionNotes || "",
    first_call_notes: input.firstCallNotes || "",
    company_name: input.companyName || "",
    next_follow_up_date: input.nextFollowUpDate || null,
  };
}

function toUpdateBody(input: UpdateClientInput, reason: string) {
  const body: Record<string, unknown> = { reason };
  if (input.clientName !== undefined) body.client_name = input.clientName;
  if (input.primaryPhone !== undefined) body.primary_phone = input.primaryPhone;
  if (input.alternatePhone !== undefined) body.alternate_phone = input.alternatePhone || "";
  if (input.primaryEmail !== undefined) body.primary_email = input.primaryEmail || "";
  if (input.alternateEmail !== undefined) body.alternate_email = input.alternateEmail || "";
  if (input.leadSourceId !== undefined) body.lead_source = input.leadSourceId;
  if (input.leadSourceOther !== undefined) body.lead_source_other = input.leadSourceOther || "";
  if (input.serviceId !== undefined) body.service = input.serviceId;
  if (input.serviceOther !== undefined) body.service_other = input.serviceOther || "";
  if (input.decisionMakerPhone !== undefined) body.decision_maker_phone = input.decisionMakerPhone || "";
  if (input.decisionMakerEmail !== undefined) body.decision_maker_email = input.decisionMakerEmail || "";
  if (input.estimatedDealValue !== undefined) body.estimated_deal_value = input.estimatedDealValue ?? null;
  if (input.clientRequirements !== undefined) body.client_requirements = input.clientRequirements || "";
  if (input.callDiscussionNotes !== undefined) body.call_discussion_notes = input.callDiscussionNotes || "";
  if (input.firstCallNotes !== undefined) body.first_call_notes = input.firstCallNotes || "";
  if (input.companyName !== undefined) body.company_name = input.companyName || "";
  if (input.nextFollowUpDate !== undefined) body.next_follow_up_date = input.nextFollowUpDate || null;
  return body;
}

function clientsCacheKey(filters: ClientFilters = {}) {
  return `clients:${filters.search || ""}:${filters.stageId || ""}:${filters.sourceId || ""}:${filters.serviceId || ""}:${filters.dateFrom || ""}:${filters.dateTo || ""}:${filters.firstCallCompleted ?? ""}`;
}

export function invalidateClientsCache() {
  cacheInvalidate("clients:");
}

function bumpCaches() {
  invalidateClientsCache();
  invalidateActivityCache();
}

export async function listClients(filters: ClientFilters = {}, signal?: AbortSignal, opts?: { force?: boolean }) {
  const key = clientsCacheKey(filters);
  if (!opts?.force) {
    const cached = cacheGet<Client[]>(key);
    if (cached) return cached;
  }
  const rows = await apiRequest<ApiClient[]>("/api/clients/", {
    signal,
    query: {
      search: filters.search,
      stage: filters.stageId,
      source: filters.sourceId,
      service: filters.serviceId,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      first_call_completed:
        typeof filters.firstCallCompleted === "boolean"
          ? filters.firstCallCompleted
            ? "true"
            : "false"
          : undefined,
      page_size: filters.page_size ?? 100,
    },
  });
  const mapped = (rows || []).map(mapClient);
  cacheSet(key, mapped);
  return mapped;
}

export async function getClient(id: string, signal?: AbortSignal, opts?: { force?: boolean }) {
  const key = `clients:detail:${id}`;
  if (!opts?.force) {
    const cached = cacheGet<Client>(key);
    if (cached) return cached;
  }
  const row = await apiRequest<ApiClient>(`/api/clients/${id}/`, { signal });
  const mapped = mapClient(row);
  cacheSet(key, mapped);
  return mapped;
}

export async function createClient(input: CreateClientInput) {
  const row = await apiRequest<ApiClient>("/api/clients/", {
    method: "POST",
    body: toCreateBody(input),
  });
  bumpCaches();
  return mapClient(row);
}

export async function updateClient(id: string, patch: UpdateClientInput, reason: string) {
  const { stageId, firstCallCompleted, ...rest } = patch;
  await apiRequest<ApiClient>(`/api/clients/${id}/`, {
    method: "PATCH",
    body: toUpdateBody(rest, reason),
  });
  if (stageId) {
    await apiRequest(`/api/clients/${id}/stage/`, {
      method: "POST",
      body: { stage: stageId },
    });
  }
  if (firstCallCompleted === true) {
    try {
      await apiRequest(`/api/clients/${id}/first-call/`, {
        method: "POST",
        body: {
          decision_maker_phone: patch.decisionMakerPhone || "",
          decision_maker_email: patch.decisionMakerEmail || "",
          estimated_deal_value: patch.estimatedDealValue ?? null,
          client_requirements: patch.clientRequirements || "",
          call_discussion_notes: patch.callDiscussionNotes || "",
          first_call_notes: patch.firstCallNotes || "",
          next_follow_up_date: patch.nextFollowUpDate || null,
        },
      });
    } catch {
      // Already completed is fine
    }
  }
  bumpCaches();
  return getClient(id, undefined, { force: true });
}

export async function deleteClient(id: string, reason: string) {
  await apiRequest(`/api/clients/${id}/`, {
    method: "DELETE",
    body: { reason },
  });
  bumpCaches();
}

export async function moveClientStage(id: string, stageId: string) {
  await apiRequest(`/api/clients/${id}/stage/`, {
    method: "POST",
    body: { stage: stageId },
  });
  bumpCaches();
  return getClient(id);
}
