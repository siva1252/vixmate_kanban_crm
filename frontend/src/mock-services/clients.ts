import { STAGES, clients, pushActivity, touchClient, uid } from "@/mock-data/store";
import type { Client, LeadStageSlug } from "@/types";

export type ClientFilters = {
  search?: string;
  stageId?: string;
  sourceId?: string;
  serviceId?: string;
  teamMemberId?: string;
  firstCallCompleted?: boolean;
};

export function listClients(filters: ClientFilters = {}): Client[] {
  return clients.filter((c) => {
    if (filters.stageId && c.stageId !== filters.stageId) return false;
    if (filters.sourceId && c.leadSourceId !== filters.sourceId) return false;
    if (filters.serviceId && c.serviceId !== filters.serviceId) return false;
    if (typeof filters.firstCallCompleted === "boolean" && c.firstCallCompleted !== filters.firstCallCompleted) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const hay = `${c.clientName} ${c.primaryPhone} ${c.primaryEmail ?? ""} ${c.companyName ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function getClient(id: string) {
  return clients.find((c) => c.id === id) ?? null;
}

export function createClient(
  input: Omit<Client, "id" | "createdAt" | "updatedAt" | "stageId"> & { stageId?: string },
  actorId: string
) {
  const now = new Date().toISOString();
  const client: Client = { ...input, id: uid("cl"), stageId: input.stageId ?? STAGES[0].id, createdAt: now, updatedAt: now };
  clients.unshift(client);
  pushActivity({ actorId, action: "client_created", entityType: "Client", entityId: client.id, clientId: client.id, newValues: { clientName: client.clientName } });
  return client;
}

export function updateClient(id: string, patch: Partial<Client>, actorId: string, reason?: string) {
  const current = getClient(id);
  if (!current) throw new Error("Client not found");
  if (patch.estimatedDealValue !== undefined && patch.estimatedDealValue !== current.estimatedDealValue && !(reason && reason.trim().length >= 3)) {
    throw new Error("Deal value changes require a reason.");
  }
  const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
  clients[clients.findIndex((c) => c.id === id)] = updated;
  pushActivity({ actorId, action: "client_updated", entityType: "Client", entityId: id, clientId: id, oldValues: { estimatedDealValue: current.estimatedDealValue }, newValues: { estimatedDealValue: updated.estimatedDealValue }, reason });
  return updated;
}

export function deleteClient(id: string, actorId: string, reason: string) {
  if (!reason || reason.trim().length < 3) throw new Error("A reason is required to delete a client.");
  const idx = clients.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error("Client not found");
  const [removed] = clients.splice(idx, 1);
  pushActivity({ actorId, action: "client_deleted", entityType: "Client", entityId: id, clientId: id, reason, oldValues: { clientName: removed.clientName } });
}

export function moveClientStage(id: string, stageId: string, actorId: string) {
  const current = getClient(id);
  if (!current) throw new Error("Client not found");
  const stage = STAGES.find((s) => s.id === stageId);
  if (!stage) throw new Error("Invalid stage");
  const previous = STAGES.find((s) => s.id === current.stageId);
  current.stageId = stageId;
  touchClient(id);
  pushActivity({ actorId, action: "stage_changed", entityType: "Client", entityId: id, clientId: id, oldValues: { stage: previous?.slug }, newValues: { stage: stage.slug as LeadStageSlug } });
  return current;
}

export function markFirstCallComplete(id: string, patch: Partial<Client>, actorId: string) {
  const current = getClient(id);
  if (!current) throw new Error("Client not found");
  if (current.firstCallCompleted) throw new Error("First call already completed");
  return updateClient(id, { ...patch, firstCallCompleted: true }, actorId);
}