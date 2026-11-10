"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { meetings as meetingStore, TEAM, uid } from "@/mock-data/store";
import { getSession } from "@/mock-services/auth";
import { useToast } from "@/components/toast";

export default function MeetingsPage() {
  const [title, setTitle] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>(["tm-1"]);
  const [items, setItems] = useState(meetingStore);
  const { push } = useToast();

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Meetings</h1>
      <div className="space-y-2 rounded-xl border bg-white/80 p-4 dark:border-stone-800 dark:bg-stone-950/60">
        <Input placeholder="Meeting title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {TEAM.map((m) => {
            const active = participantIds.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                className={`rounded-full px-3 py-1 text-xs ${active ? "bg-teal-900 text-white" : "bg-stone-200"}`}
                onClick={() =>
                  setParticipantIds((prev) =>
                    active ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                  )
                }
              >
                {m.displayName}
              </button>
            );
          })}
        </div>
        <Button
          onClick={() => {
            const session = getSession();
            if (!session || !title.trim() || participantIds.length === 0) return;
            meetingStore.unshift({
              id: uid("mt"),
              clientId: "cl-1",
              title: title.trim(),
              meetingDate: new Date().toISOString().slice(0, 10),
              startTime: "10:00",
              endTime: "11:00",
              coordinatorId: session.teamMemberId,
              participantIds,
              meetingType: "online",
              status: "scheduled",
            });
            setItems([...meetingStore]);
            setTitle("");
            push("Meeting created");
          }}
        >
          Create meeting
        </Button>
      </div>
      <ul className="space-y-2">
        {items.map((m) => (
          <li key={m.id} className="rounded-lg border p-3">
            <p className="font-medium">{m.title}</p>
            <p className="text-xs text-stone-500">
              {m.meetingDate} · {m.status} · Participants:{" "}
              {m.participantIds.map((id) => TEAM.find((t) => t.id === id)?.displayName).join(", ")}
            </p>
            <Button
              size="sm"
              className="mt-2"
              variant="secondary"
              onClick={() => {
                m.status = "rescheduled";
                m.meetingDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
                setItems([...meetingStore]);
                push("Meeting rescheduled");
              }}
            >
              Reschedule +1 day
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
