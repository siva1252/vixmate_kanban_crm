import { describe, expect, it } from "vitest";
import { clients } from "@/mock-data/store";
import { createClient, deleteClient, moveClientStage } from "@/mock-services/clients";

describe("mock client services", () => {
  it("creates a lead in New Lead stage by default", () => {
    const before = clients.length;
    const client = createClient(
      {
        clientName: "Test Co",
        primaryPhone: "111",
        leadSourceId: "src-1",
        serviceId: "svc-6",
        firstCallCompleted: false,
      },
      "tm-1"
    );
    expect(clients.length).toBe(before + 1);
    expect(client.stageId).toBe("st-1");
  });

  it("requires reason for delete", () => {
    const client = createClient(
      {
        clientName: "Delete Me",
        primaryPhone: "222",
        leadSourceId: "src-1",
        serviceId: "svc-6",
        firstCallCompleted: false,
      },
      "tm-1"
    );
    expect(() => deleteClient(client.id, "tm-1", "")).toThrow(/reason/i);
  });

  it("moves kanban stage locally", () => {
    const client = createClient(
      {
        clientName: "Move Me",
        primaryPhone: "333",
        leadSourceId: "src-1",
        serviceId: "svc-6",
        firstCallCompleted: false,
      },
      "tm-1"
    );
    const moved = moveClientStage(client.id, "st-4", "tm-1");
    expect(moved.stageId).toBe("st-4");
  });
});
