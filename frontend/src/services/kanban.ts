import { apiRequest } from "@/lib/api";
import { cacheGet, cacheInvalidate, cacheSet } from "@/lib/api-cache";
import { mapClient, moveClientStage, invalidateClientsCache } from "@/services/clients";
import { invalidateActivityCache } from "@/services/activity";
import type { Client, LeadStage } from "@/types";

type ApiStage = {
  id: string;
  name: string;
  slug: string;
  display_order: number;
  is_terminal: boolean;
  color?: string;
};

type ApiBoardColumn = {
  stage: ApiStage;
  cards: Array<Parameters<typeof mapClient>[0]>;
};

export type KanbanColumn = {
  stage: LeadStage;
  cards: Client[];
};

function mapStage(row: ApiStage): LeadStage {
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    displayOrder: row.display_order,
    isTerminal: Boolean(row.is_terminal),
    color: row.color,
  };
}

const BOARD_KEY = "kanban:board";

export async function fetchKanbanBoard(
  filters: {
    search?: string;
    sourceId?: string;
    serviceId?: string;
    teamMemberId?: string;
  } = {},
  signal?: AbortSignal,
  opts?: { force?: boolean }
): Promise<KanbanColumn[]> {
  const key = `${BOARD_KEY}:${filters.search || ""}:${filters.sourceId || ""}:${filters.serviceId || ""}:${filters.teamMemberId || ""}`;
  if (!opts?.force) {
    const cached = cacheGet<KanbanColumn[]>(key);
    if (cached) return cached;
  }
  const board = await apiRequest<ApiBoardColumn[]>("/api/kanban/board/", {
    signal,
    query: {
      search: filters.search,
      source: filters.sourceId,
      service: filters.serviceId,
      team_member: filters.teamMemberId,
    },
  });
  const mapped = (board || []).map((col) => ({
    stage: mapStage(col.stage),
    cards: (col.cards || []).map(mapClient),
  }));
  cacheSet(key, mapped);
  return mapped;
}

export async function moveCard(clientId: string, toStageId: string) {
  const client = await moveClientStage(clientId, toStageId);
  cacheInvalidate("kanban:");
  invalidateClientsCache();
  invalidateActivityCache();
  return client;
}

export function invalidateKanbanCache() {
  cacheInvalidate("kanban:");
}
