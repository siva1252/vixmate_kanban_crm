"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TEAM } from "@/mock-data/store";
import type { AvailabilityStatus } from "@/types";
import { useToast } from "@/components/toast";

const statuses: AvailabilityStatus[] = ["available", "busy", "on_leave"];

export default function TeamPage() {
  const [members, setMembers] = useState(TEAM);
  const { push } = useToast();

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Team members</h1>
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <div>
              <p className="font-medium">{m.displayName}</p>
              <p className="text-xs text-stone-500">
                {m.email} · {m.jobTitle}
              </p>
            </div>
            <div className="flex gap-1">
              {statuses.map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={m.availabilityStatus === status ? "default" : "outline"}
                  onClick={() => {
                    m.availabilityStatus = status;
                    setMembers([...TEAM]);
                    push(`${m.displayName} marked ${status.replace("_", " ")}`);
                  }}
                >
                  {status.replace("_", " ")}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
