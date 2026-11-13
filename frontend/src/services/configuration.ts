import { apiRequest } from "@/lib/api";
import { cacheGet, cacheInvalidate, cacheSet } from "@/lib/api-cache";
import type { LeadSource, LeadStage, ServiceOption } from "@/types";

type ApiSource = {
  id: string;
  name: string;
  slug: string;
  allows_other_text: boolean;
};

type ApiService = {
  id: string;
  name: string;
  slug: string;
  allows_other_text: boolean;
};

type ApiStage = {
  id: string;
  name: string;
  slug: string;
  display_order: number;
  is_terminal: boolean;
  color?: string;
};

type ConfigBundle = {
  lead_sources: ApiSource[];
  services: ApiService[];
  industries: unknown[];
};

export type CrmConfig = {
  leadSources: LeadSource[];
  services: ServiceOption[];
  stages: LeadStage[];
};

const CONFIG_KEY = "config:bundle";
const STAGES_KEY = "config:stages";

function mapSource(row: ApiSource): LeadSource {
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    allowsOtherText: Boolean(row.allows_other_text),
  };
}

function mapService(row: ApiService): ServiceOption {
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    allowsOtherText: Boolean(row.allows_other_text),
  };
}

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

export async function fetchCrmConfig(signal?: AbortSignal, opts?: { force?: boolean }): Promise<CrmConfig> {
  if (!opts?.force) {
    const cached = cacheGet<CrmConfig>(CONFIG_KEY, 5 * 60_000);
    if (cached) return cached;
  }

  const [bundle, stages] = await Promise.all([
    apiRequest<ConfigBundle>("/api/configuration/", { signal }),
    (async () => {
      if (!opts?.force) {
        const hit = cacheGet<LeadStage[]>(STAGES_KEY, 5 * 60_000);
        if (hit) return hit;
      }
      const rows = await apiRequest<ApiStage[]>("/api/kanban/stages/", { signal });
      const mapped = (rows || []).map(mapStage).sort((a, b) => a.displayOrder - b.displayOrder);
      cacheSet(STAGES_KEY, mapped);
      return mapped;
    })(),
  ]);

  const config: CrmConfig = {
    leadSources: (bundle.lead_sources || []).map(mapSource),
    services: (bundle.services || []).map(mapService),
    stages,
  };
  cacheSet(CONFIG_KEY, config);
  return config;
}

export function invalidateCrmConfig() {
  cacheInvalidate("config:");
}
