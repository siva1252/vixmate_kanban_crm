import { STAGES } from "@/mock-data/store";
import { listClients, moveClientStage } from "@/mock-services/clients";
import type { Client, LeadStage } from "@/types";

export function getKanbanBoard(filters?: Parameters<typeof listClients>[0]) {
  const cards = listClients(filters);
  return STAGES.map((stage) => ({
    stage,
    cards: cards.filter((c) => c.stageId === stage.id),
  }));
}

export function moveCard(
  clientId: string,
  toStageId: string,
  actorId: string
): { stage: LeadStage; client: Client } {
  const client = moveClientStage(clientId, toStageId, actorId);
  const stage = STAGES.find((s) => s.id === toStageId)!;
  return { stage, client };
}
