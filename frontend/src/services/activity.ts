import { apiRequest } from "@/lib/api";
import { cacheGet, cacheInvalidate, cacheSet } from "@/lib/api-cache";

export type ActivityLogRow = {
  id: string;
  actor: string | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  client: string | null;
  client_name: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  description?: string;
  reason?: string;
  timestamp: string;
  ip_address?: string | null;
  request_id?: string | null;
};

export type ActivityQuery = {
  search?: string;
  team_member?: string;
  client?: string;
  action?: string;
  entity_type?: string;
  page?: number;
  page_size?: number;
};

function activityCacheKey(query: ActivityQuery) {
  return `activity:${query.search || ""}:${query.team_member || ""}:${query.client || ""}:${query.action || ""}:${query.entity_type || ""}:${query.page ?? 1}:${query.page_size ?? 100}`;
}

export async function fetchActivityLogs(
  query: ActivityQuery = {},
  signal?: AbortSignal,
  opts?: { force?: boolean }
) {
  const key = activityCacheKey(query);
  if (!opts?.force) {
    const cached = cacheGet<ActivityLogRow[]>(key);
    if (cached) return cached;
  }
  const rows = await apiRequest<ActivityLogRow[]>("/api/activity/", {
    query: {
      search: query.search,
      team_member: query.team_member,
      client: query.client,
      action: query.action,
      entity_type: query.entity_type,
      page: query.page ?? 1,
      page_size: query.page_size ?? 100,
    },
    signal,
  });
  const data = Array.isArray(rows) ? rows : [];
  cacheSet(key, data);
  return data;
}

export function invalidateActivityCache() {
  cacheInvalidate("activity:");
}
