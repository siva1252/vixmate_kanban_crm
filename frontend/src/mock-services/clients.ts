import { STAGES, clients, pushActivity, touchClient, uid } from "@/mock-data/store";
import type { Client } from "@/types";

export type ClientFilters = {
  search?: string;
  stageId?: string;
  sourceId?: string;
  serviceId?: string;
  clientId?: string;
  clientName?: string;
  email?: string;
  dateFrom?: string;
  dateTo?: string;
  teamMemberId?: string;
  firstCallCompleted?: boolean;
};

function dayStamp(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function listClients(filters: ClientFilters = {}): Client[] {
  return clients.filter((c) => {
    if (filters.stageId && c.stageId !== filters.stageId) return false;
    if (filters.sourceId && c.leadSourceId !== filters.sourceId) return false;
    if (filters.serviceId && c.serviceId !== filters.serviceId) return false;
    if (filters.clientId && c.id !== filters.clientId) return false;
    if (filters.clientName && c.clientName.toLowerCase() !== filters.clientName.toLowerCase()) {
      return false;
    }
    if (filters.email) {
      const q = filters.email.toLowerCase();
      const emails = `${c.primaryEmail ?? ""} ${c.alternateEmail ?? ""}`.toLowerCase();
      if (!emails.includes(q)) return false;
    }
    if (filters.dateFrom || filters.dateTo) {
      const stamp = dayStamp(c.updatedAt) ?? dayStamp(c.createdAt);
      if (!stamp) return false;
      if (filters.dateFrom && stamp < filters.dateFrom) return false;
      if (filters.dateTo && stamp > filters.dateTo) return false;
    }
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
  const stageName = STAGES.find((s) => s.id === client.stageId)?.name ?? client.stageId;
  pushActivity({
    actorId,
    action: "client_created",
    entityType: "Client",
    entityId: client.id,
    clientId: client.id,
    newValues: {
      clientName: client.clientName,
      primaryPhone: client.primaryPhone,
      primaryEmail: client.primaryEmail,
      stage: stageName,
      leadSourceId: client.leadSourceId,
      serviceId: client.serviceId,
    },
  });
  return client;
}

export function updateClient(id: string, patch: Partial<Client>, actorId: string, reason?: string) {
  const current = getClient(id);
  if (!current) throw new Error("Client not found");
  if (!(reason && reason.trim().length >= 3)) {
    throw new Error("A reason is required to update a client.");
  }
  const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
  clients[clients.findIndex((c) => c.id === id)] = updated;

  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as (keyof Client)[]) {
    const before = current[key];
    const after = updated[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      oldValues[key as string] = before;
      newValues[key as string] = after;
    }
  }

  pushActivity({
    actorId,
    action: "client_updated",
    entityType: "Client",
    entityId: id,
    clientId: id,
    oldValues,
    newValues,
    reason: reason.trim(),
  });
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
  pushActivity({
    actorId,
    action: "stage_changed",
    entityType: "Client",
    entityId: id,
    clientId: id,
    oldValues: { stage: previous?.name ?? previous?.slug },
    newValues: { stage: stage.name },
  });
  return current;
}

export function markFirstCallComplete(id: string, patch: Partial<Client>, actorId: string) {
  const current = getClient(id);
  if (!current) throw new Error("Client not found");
  if (current.firstCallCompleted) throw new Error("First call already completed");
  return updateClient(id, { ...patch, firstCallCompleted: true }, actorId, "First call completed");
}