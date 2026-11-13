import { apiRequest } from "@/lib/api";
import { cacheGet, cacheInvalidate, cacheSet } from "@/lib/api-cache";
import type { AvailabilityStatus, TeamMember } from "@/types";

type ApiTeamMember = {
  id: string;
  user_id?: string;
  display_name: string;
  job_title: string;
  is_active: boolean;
  availability_status: AvailabilityStatus;
  email: string;
  full_name?: string;
};

const TEAM_CACHE_KEY = "team:list";

export function mapTeamMember(row: ApiTeamMember): TeamMember & { userId?: string } {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : undefined,
    displayName: row.display_name,
    email: row.email,
    jobTitle: row.job_title || "",
    availabilityStatus: row.availability_status,
    isActive: row.is_active,
  };
}

export async function fetchTeamMembers(signal?: AbortSignal, opts?: { force?: boolean }) {
  if (!opts?.force) {
    const cached = cacheGet<Array<TeamMember & { userId?: string }>>(TEAM_CACHE_KEY);
    if (cached) return cached;
  }
  const rows = await apiRequest<ApiTeamMember[]>("/api/team/", { signal });
  const mapped = (rows || []).map(mapTeamMember);
  cacheSet(TEAM_CACHE_KEY, mapped);
  return mapped;
}

export function invalidateTeamCache() {
  cacheInvalidate("team:");
}
