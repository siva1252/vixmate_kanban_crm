"use client";

import { useState } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import { Button } from "@/components/ui/button";
import {
  RESPONSIBILITIES,
  TEAM,
  assignments as assignmentStore,
  pushActivity,
  uid,
} from "@/mock-data/store";
import { getSession } from "@/mock-services/auth";
import { useToast } from "@/components/toast";

export default function AssignmentsPage() {
  const [items, setItems] = useState(assignmentStore.filter((a) => a.isActive));
  const [reassign, setReassign] = useState<{
    responsibilityTypeId: string;
    previousMemberId: string;
  } | null>(null);
  const { push } = useToast();

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Responsibility assignments</h1>
      <ul className="space-y-2">
        {items.map((a) => {
          const resp = RESPONSIBILITIES.find((r) => r.id === a.responsibilityTypeId)?.name;
          const member = TEAM.find((t) => t.id === a.teamMemberId)?.displayName;
          return (
            <li key={a.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{resp}</p>
                <p className="text-sm text-stone-500">{member} · client {a.clientId}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setReassign({
                    responsibilityTypeId: a.responsibilityTypeId,
                    previousMemberId: a.teamMemberId,
                  })
                }
              >
                Reassign
              </Button>
            </li>
          );
        })}
      </ul>
      <ReasonDialog
        open={Boolean(reassign)}
        title="Reassign responsibility"
        description="A reason is mandatory for responsibility reassignment."
        onClose={() => setReassign(null)}
        onConfirm={(reason) => {
          if (!reassign) return;
          const session = getSession();
          const current = assignmentStore.find(
            (a) =>
              a.responsibilityTypeId === reassign.responsibilityTypeId &&
              a.teamMemberId === reassign.previousMemberId &&
              a.isActive
          );
          if (current) current.isActive = false;
          const nextMember = TEAM.find((t) => t.id !== reassign.previousMemberId) ?? TEAM[0];
          assignmentStore.push({
            id: uid("as"),
            clientId: current?.clientId ?? "cl-2",
            responsibilityTypeId: reassign.responsibilityTypeId,
            teamMemberId: nextMember.id,
            isActive: true,
          });
          pushActivity({
            actorId: session?.teamMemberId,
            action: "assignment_reassigned",
            entityType: "LeadAssignment",
            entityId: current?.id ?? "",
            clientId: current?.clientId,
            reason,
            oldValues: { member: reassign.previousMemberId },
            newValues: { member: nextMember.id },
          });
          setItems(assignmentStore.filter((a) => a.isActive));
          setReassign(null);
          push("Responsibility reassigned");
        }}
      />
    </div>
  );
}
