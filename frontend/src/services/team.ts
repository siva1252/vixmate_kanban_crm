import { apiRequest } from "@/lib/api";
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

export async function fetchTeamMembers(signal?: AbortSignal) {
  const rows = await apiRequest<ApiTeamMember[]>("/api/team/", { signal });
  return (rows || []).map(mapTeamMember);
}
