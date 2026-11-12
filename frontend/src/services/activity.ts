import { apiRequest } from "@/lib/api";

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
  action?: string;
  entity_type?: string;
  page?: number;
  page_size?: number;
};

export async function fetchActivityLogs(query: ActivityQuery = {}, signal?: AbortSignal) {
  return apiRequest<ActivityLogRow[]>("/api/activity/", {
    query: {
      search: query.search,
      team_member: query.team_member,
      action: query.action,
      entity_type: query.entity_type,
      page: query.page ?? 1,
      page_size: query.page_size ?? 100,
    },
    signal,
  });
}
