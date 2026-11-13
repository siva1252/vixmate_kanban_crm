"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { ReasonDialog } from "@/components/reason-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/toast";
import { ApiError } from "@/lib/api";
import { cacheGet } from "@/lib/api-cache";
import { cn } from "@/lib/utils";
import type { LeadSourcePerson } from "@/types";
import {
  assignPeopleToLead,
  createLeadSourcePerson,
  fetchClientsForAssign,
  fetchLeadSourcePeople,
  fetchPersonLeads,
  unlinkAttribution,
  updateLeadSourcePerson,
} from "@/services/lead-source";

const PHONE_MAX = 15;
const NAME_MAX = 80;
const EMAIL_MAX = 120;

const selectClass =
  "h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900";

type LeadSourcePersonRow = LeadSourcePerson & { leadCount?: number };

type PersonAttribution = {
  id: string;
  client: string;
  client_name: string;
  stage_name?: string;
};

type AssignClient = { id: string; clientName: string };

function sanitizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, PHONE_MAX);
}

function sanitizeEmail(value: string) {
  return value.replace(/\s/g, "").slice(0, EMAIL_MAX);
}

function isValidEmail(value: string) {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function apiErrorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export default function LeadSourcePage() {
  const [people, setPeople] = useState<LeadSourcePersonRow[]>(
    () => cacheGet<LeadSourcePersonRow[]>("lead-source::active:::") ?? []
  );
  const [allPeopleOptions, setAllPeopleOptions] = useState<LeadSourcePersonRow[]>(
    () => cacheGet<LeadSourcePersonRow[]>("lead-source::all:::") ?? []
  );
  const [assignClients, setAssignClients] = useState<AssignClient[]>([]);
  const [listLoading, setListLoading] = useState(
    () => !cacheGet("lead-source::active:::")
  );
  const [totalCount, setTotalCount] = useState(
    () => (cacheGet<LeadSourcePersonRow[]>("lead-source::active:::") ?? []).length
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [personAttributions, setPersonAttributions] = useState<PersonAttribution[]>([]);
  const [personStats, setPersonStats] = useState({ total: 0, open: 0, won: 0, lost: 0 });
  const [detailLoading, setDetailLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [personIdFilter, setPersonIdFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState<"all" | "with" | "without">("all");
  const [leadIdFilter, setLeadIdFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [form, setForm] = useState({
    displayName: "",
    phone: "",
    email: "",
    roleLabel: "",
    notes: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [assignClientId, setAssignClientId] = useState("");
  const [assignPersonIds, setAssignPersonIds] = useState<string[]>([]);
  const [assignNote, setAssignNote] = useState("");
  const [deactivateTarget, setDeactivateTarget] = useState<LeadSourcePersonRow | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [deactivateLeadAction, setDeactivateLeadAction] = useState<"remove" | "keep">("keep");
  const [deactivateError, setDeactivateError] = useState("");
  const [unlinkTarget, setUnlinkTarget] = useState<{
    attributionId: string;
    clientName: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const statusQuery = useMemo(() => {
    if (statusFilter === "all") return "all";
    if (statusFilter === "inactive") return "inactive";
    return "active";
  }, [statusFilter]);

  const hasLeadsQuery = useMemo(() => {
    if (assignedFilter === "with") return "true";
    if (assignedFilter === "without") return "false";
    return undefined;
  }, [assignedFilter]);

  const reloadList = useCallback(async (signal?: AbortSignal) => {
    try {
      const rows = await fetchLeadSourcePeople(
        {
          search: debouncedSearch || undefined,
          status: statusQuery,
          has_leads: hasLeadsQuery,
          client: leadIdFilter || undefined,
        },
        signal
      );
      if (signal?.aborted) return;
      const unfilteredLen = rows.length;
      const visible = personIdFilter ? rows.filter((p) => p.id === personIdFilter) : rows;
      setPeople(visible);
      setTotalCount(unfilteredLen);
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
      push(apiErrorMessage(err, "Failed to load Lead Source people"), "error");
    } finally {
      if (!signal?.aborted) setListLoading(false);
    }
  }, [debouncedSearch, statusQuery, hasLeadsQuery, leadIdFilter, personIdFilter, push]);

  useEffect(() => {
    const ac = new AbortController();
    void reloadList(ac.signal);
    return () => ac.abort();
  }, [reloadList]);

  useEffect(() => {
    const ac = new AbortController();
    void fetchLeadSourcePeople({ status: "all" }, ac.signal)
      .then((rows) => {
        if (!ac.signal.aborted) setAllPeopleOptions(rows);
      })
      .catch((err) => {
        if (ac.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
        setAllPeopleOptions([]);
      });
    return () => ac.abort();
  }, []);

  // Load leads only when Assign modal opens — avoids extra /clients traffic on every page visit.
  useEffect(() => {
    if (!assignOpen || assignClients.length > 0) return;
    const ac = new AbortController();
    void fetchClientsForAssign(ac.signal)
      .then((rows) => {
        if (ac.signal.aborted) return;
        setAssignClients(
          (rows || []).map((c) => ({
            id: String(c.id),
            clientName: c.client_name,
          }))
        );
      })
      .catch((err) => {
        if (ac.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
        setAssignClients([]);
      });
    return () => ac.abort();
  }, [assignOpen, assignClients.length]);

  const personNameOptions = useMemo(() => {
    return [...allPeopleOptions]
      .map((p) => ({ id: p.id, name: p.displayName }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allPeopleOptions]);

  const filtersActive =
    Boolean(search.trim()) ||
    Boolean(personIdFilter) ||
    assignedFilter !== "all" ||
    Boolean(leadIdFilter) ||
    statusFilter !== "active";

  const clearFilters = () => {
    setSearch("");
    setPersonIdFilter("");
    setAssignedFilter("all");
    setLeadIdFilter("");
    setStatusFilter("active");
  };

  const selected = useMemo(
    () => people.find((p) => p.id === selectedId) ?? allPeopleOptions.find((p) => p.id === selectedId) ?? null,
    [people, allPeopleOptions, selectedId]
  );

  useEffect(() => {
    if (!selectedId) {
      setPersonAttributions([]);
      setPersonStats({ total: 0, open: 0, won: 0, lost: 0 });
      return;
    }
    const ac = new AbortController();
    setDetailLoading(true);
    void fetchPersonLeads(selectedId, ac.signal)
      .then(({ stats, attributions }) => {
        if (ac.signal.aborted) return;
        setPersonStats(stats);
        setPersonAttributions(
          attributions.map((a) => ({
            id: a.id,
            client: String(a.client),
            client_name: a.client_name,
            stage_name: a.stage_name,
          }))
        );
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        push(apiErrorMessage(err, "Failed to load linked leads"), "error");
        setPersonAttributions([]);
        setPersonStats({ total: 0, open: 0, won: 0, lost: 0 });
      })
      .finally(() => {
        if (!ac.signal.aborted) setDetailLoading(false);
      });
    return () => ac.abort();
  }, [selectedId, push]);

  const headerCountLabel = useMemo(() => {
    if (listLoading) return "Loading…";
    if (filtersActive) {
      return `Showing ${people.length} of ${totalCount} ${totalCount === 1 ? "person" : "people"}`;
    }
    const n = people.length;
    return `${n} ${n === 1 ? "person" : "people"}`;
  }, [listLoading, filtersActive, people.length, totalCount]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const name = form.displayName.trim();
    if (name.length < 2) errors.displayName = "Name is required (min 2 characters).";
    if (name.length > NAME_MAX) errors.displayName = `Name max ${NAME_MAX} characters.`;
    const phone = form.phone.trim();
    if (phone && (phone.length < 8 || phone.length > 15)) {
      errors.phone = "Phone must be 8–15 digits.";
    }
    if (!isValidEmail(form.email)) errors.email = "Enter a valid email.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const createPerson = async () => {
    if (!validateForm()) {
      push("Fix the form errors before saving", "error");
      return;
    }
    setSaving(true);
    try {
      const person = await createLeadSourcePerson({
        display_name: form.displayName.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim().toLowerCase() || undefined,
        role_label: form.roleLabel.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setForm({ displayName: "", phone: "", email: "", roleLabel: "", notes: "" });
      setFormErrors({});
      setCreateOpen(false);
      setSelectedId(person.id);
      push("Lead Source person created");
      await reloadList();
      const ac = new AbortController();
      void fetchLeadSourcePeople({ status: "all" }, ac.signal).then(setAllPeopleOptions);
    } catch (err) {
      push(apiErrorMessage(err, "Failed to create person"), "error");
    } finally {
      setSaving(false);
    }
  };

  const activatePerson = async (person: LeadSourcePerson) => {
    setSaving(true);
    try {
      await updateLeadSourcePerson(person.id, { is_active: true });
      push("Person activated");
      await reloadList();
    } catch (err) {
      push(apiErrorMessage(err, "Failed to activate person"), "error");
    } finally {
      setSaving(false);
    }
  };

  const openDeactivate = (person: LeadSourcePersonRow) => {
    setDeactivateTarget(person);
    setDeactivateReason("");
    setDeactivateLeadAction("keep");
    setDeactivateError("");
  };

  const closeDeactivate = () => {
    if (saving) return;
    setDeactivateTarget(null);
    setDeactivateReason("");
    setDeactivateError("");
  };

  const deactivatePerson = async () => {
    if (!deactivateTarget || saving) return;
    const reason = deactivateReason.trim();
    if (reason.length < 3) {
      setDeactivateError("Reason must be at least 3 characters.");
      return;
    }
    const leadCount = deactivateTarget.leadCount ?? 0;
    const unassign = leadCount > 0 && deactivateLeadAction === "remove";
    setSaving(true);
    setDeactivateError("");
    try {
      await updateLeadSourcePerson(deactivateTarget.id, {
        is_active: false,
        reason,
        unassign_leads: unassign,
      });
      setDeactivateTarget(null);
      setDeactivateReason("");
      if (unassign) {
        push(
          `Person deactivated — removed from ${leadCount} lead${leadCount === 1 ? "" : "s"}`
        );
      } else {
        push(
          leadCount > 0
            ? "Person deactivated — lead links kept"
            : "Person deactivated"
        );
      }
      await reloadList();
    } catch (err) {
      push(apiErrorMessage(err, "Failed to deactivate person"), "error");
    } finally {
      setSaving(false);
    }
  };

  const openAssign = (preselectPerson?: string) => {
    setAssignClientId("");
    setAssignPersonIds(preselectPerson ? [preselectPerson] : selectedId ? [selectedId] : []);
    setAssignNote("");
    setAssignOpen(true);
  };

  const toggleAssignPerson = (id: string) => {
    setAssignPersonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const saveAssign = async () => {
    if (!assignClientId || assignPersonIds.length === 0) return;
    setSaving(true);
    try {
      await assignPeopleToLead({
        client: assignClientId,
        people: assignPersonIds,
        note: assignNote.trim() || undefined,
      });
      setAssignOpen(false);
      push("Lead Source people assigned");
      await reloadList();
      if (selectedId && assignPersonIds.includes(selectedId)) {
        const ac = new AbortController();
        const { stats, attributions } = await fetchPersonLeads(selectedId, ac.signal);
        setPersonStats(stats);
        setPersonAttributions(
          attributions.map((a) => ({
            id: a.id,
            client: String(a.client),
            client_name: a.client_name,
            stage_name: a.stage_name,
          }))
        );
      }
    } catch (err) {
      push(apiErrorMessage(err, "Failed to assign people"), "error");
    } finally {
      setSaving(false);
    }
  };

  const unlink = async (attributionId: string, reason: string) => {
    setSaving(true);
    try {
      await unlinkAttribution(attributionId, reason);
      setUnlinkTarget(null);
      push("Unlinked from lead");
      await reloadList();
      if (selectedId) {
        const ac = new AbortController();
        const { stats, attributions } = await fetchPersonLeads(selectedId, ac.signal);
        setPersonStats(stats);
        setPersonAttributions(
          attributions.map((a) => ({
            id: a.id,
            client: String(a.client),
            client_name: a.client_name,
            stage_name: a.stage_name,
          }))
        );
      }
    } catch (err) {
      push(apiErrorMessage(err, "Failed to unlink"), "error");
    } finally {
      setSaving(false);
    }
  };

  const activePeopleForAssign = useMemo(
    () => allPeopleOptions.filter((p) => p.isActive),
    [allPeopleOptions]
  );

  return (
    <div className="relative space-y-4 p-3 sm:p-4 md:p-6">
      {saving ? (
        <div
          className="pointer-events-none absolute inset-x-3 top-3 z-20 h-0.5 overflow-hidden rounded-full bg-stone-200 sm:inset-x-4 md:inset-x-6 dark:bg-stone-800"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="h-full w-1/3 animate-pulse bg-teal-700" />
        </div>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="font-display text-2xl sm:text-3xl">Lead Source</h1>
            <span className="text-sm text-stone-500">{headerCountLabel}</span>
          </div>
          <p className="text-sm text-stone-500">
            Outside people only — no CRM login. Assign one lead to multiple people here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openAssign()} disabled={saving}>
            Assign to lead
          </Button>
          <Button onClick={() => setCreateOpen(true)} disabled={saving}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add person
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={selectClass}
          value={personIdFilter}
          onChange={(e) => setPersonIdFilter(e.target.value)}
          aria-label="Person name"
        >
          <option value="">All person names</option>
          {personNameOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value as typeof assignedFilter)}
          aria-label="Assigned count"
        >
          <option value="all">Any assigned count</option>
          <option value="with">Has assigned leads</option>
          <option value="without">No assigned leads</option>
        </select>
        <select
          className={selectClass}
          value={leadIdFilter}
          onChange={(e) => setLeadIdFilter(e.target.value)}
          aria-label="Lead"
        >
          <option value="">All leads</option>
          {assignClients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.clientName}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <select
            className={selectClass}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            aria-label="Status"
          >
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
            <option value="all">Active & inactive</option>
          </select>
          {filtersActive ? (
            <Button variant="outline" className="h-10 shrink-0" onClick={clearFilters}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((p) => {
          const count = p.leadCount ?? 0;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "w-full rounded-xl border border-stone-200 bg-white/80 p-4 text-left transition hover:border-teal-700/40 hover:shadow-sm dark:border-stone-800 dark:bg-stone-950/50",
                  selectedId === p.id && "border-teal-800 ring-1 ring-teal-800/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-stone-800 text-sm font-semibold text-white">
                    {initials(p.displayName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-xl tracking-tight">{p.displayName}</p>
                    <p className="truncate text-sm text-stone-500">{p.roleLabel || "External"}</p>
                  </div>
                </div>
                <p className="mt-3 truncate text-sm text-stone-600 dark:text-stone-300">
                  {p.email || p.phone || "—"}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
                  <span>{p.isActive ? "Active" : "Inactive"}</span>
                  <span>
                    {count} lead{count === 1 ? "" : "s"}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {!listLoading && people.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
          No people match these filters.
        </p>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4">
          <div className="absolute inset-0" onClick={() => setSelectedId(null)} aria-hidden />
          <div className="relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl dark:border-stone-800 dark:bg-stone-950">
            <div className="flex items-start justify-between gap-3 border-b border-stone-200 p-4 dark:border-stone-800">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-stone-800 text-sm font-semibold text-white">
                  {initials(selected.displayName)}
                </span>
                <div>
                  <h2 className="font-display text-2xl tracking-tight">{selected.displayName}</h2>
                  <p className="text-sm text-stone-500">{selected.roleLabel || "External"} · No CRM access</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4 overflow-y-auto p-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">Phone</dt>
                  <dd className="mt-1">{selected.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">Email</dt>
                  <dd className="mt-1 break-all">{selected.email || "—"}</dd>
                </div>
              </dl>
              {selected.notes ? (
                <p className="rounded-lg bg-stone-100 p-3 text-sm dark:bg-stone-900">{selected.notes}</p>
              ) : null}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Total", personStats.total],
                  ["Open", personStats.open],
                  ["Won", personStats.won],
                  ["Lost", personStats.lost],
                ].map(([label, value]) => (
                  <div
                    key={label as string}
                    className="rounded-lg border border-stone-200 p-3 text-center dark:border-stone-800"
                  >
                    <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
                    <p className="mt-1 font-display text-2xl">
                      {detailLoading ? "…" : (value as number)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => openAssign(selected.id)} disabled={saving}>
                  Assign lead
                </Button>
                {selected.isActive ? (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => openDeactivate(selected)}
                    disabled={saving}
                  >
                    Deactivate
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => activatePerson(selected)}
                    disabled={saving}
                  >
                    Activate
                  </Button>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Linked leads</h3>
                <ul className="space-y-2">
                  {personAttributions.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm dark:border-stone-800"
                    >
                      <Link
                        href={`/leads/${row.client}`}
                        className="min-w-0 flex-1 truncate font-medium hover:underline"
                      >
                        {row.client_name}
                      </Link>
                      <span className="shrink-0 text-xs text-stone-500">{row.stage_name ?? "—"}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-red-700"
                        disabled={saving}
                        onClick={() =>
                          setUnlinkTarget({
                            attributionId: row.id,
                            clientName: row.client_name,
                          })
                        }
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                  {!detailLoading && personAttributions.length === 0 ? (
                    <li className="text-sm text-stone-500">No leads yet — use Assign lead.</li>
                  ) : null}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4">
          <div className="absolute inset-0" onClick={() => setCreateOpen(false)} aria-hidden />
          <div className="relative z-10 max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-4 shadow-xl dark:border-stone-800 dark:bg-stone-950">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">Add Lead Source person</h2>
              <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-stone-500">Record only — no password or CRM access.</p>
            <label className="block text-sm">
              <span className="text-stone-500">Name *</span>
              <input
                className={cn(
                  "mt-1 w-full rounded-lg border bg-transparent px-3 py-2 dark:border-stone-700",
                  formErrors.displayName ? "border-rose-500" : "border-stone-300"
                )}
                maxLength={NAME_MAX}
                value={form.displayName}
                onChange={(e) => {
                  setForm((f) => ({ ...f, displayName: e.target.value.slice(0, NAME_MAX) }));
                  setFormErrors((err) => ({ ...err, displayName: "" }));
                }}
                placeholder="Full name"
              />
              {formErrors.displayName ? (
                <p className="mt-1 text-xs text-rose-700">{formErrors.displayName}</p>
              ) : null}
            </label>
            <label className="block text-sm">
              <span className="text-stone-500">Phone</span>
              <input
                className={cn(
                  "mt-1 w-full rounded-lg border bg-transparent px-3 py-2 dark:border-stone-700",
                  formErrors.phone ? "border-rose-500" : "border-stone-300"
                )}
                inputMode="numeric"
                maxLength={PHONE_MAX}
                value={form.phone}
                onChange={(e) => {
                  setForm((f) => ({ ...f, phone: sanitizePhone(e.target.value) }));
                  setFormErrors((err) => ({ ...err, phone: "" }));
                }}
                placeholder="8–15 digits"
              />
              {formErrors.phone ? <p className="mt-1 text-xs text-rose-700">{formErrors.phone}</p> : null}
            </label>
            <label className="block text-sm">
              <span className="text-stone-500">Email</span>
              <input
                className={cn(
                  "mt-1 w-full rounded-lg border bg-transparent px-3 py-2 dark:border-stone-700",
                  formErrors.email ? "border-rose-500" : "border-stone-300"
                )}
                type="email"
                maxLength={EMAIL_MAX}
                value={form.email}
                onChange={(e) => {
                  setForm((f) => ({ ...f, email: sanitizeEmail(e.target.value) }));
                  setFormErrors((err) => ({ ...err, email: "" }));
                }}
                placeholder="name@company.com"
              />
              {formErrors.email ? <p className="mt-1 text-xs text-rose-700">{formErrors.email}</p> : null}
            </label>
            <label className="block text-sm">
              <span className="text-stone-500">Role (agency / introducer)</span>
              <input
                className="mt-1 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-2 dark:border-stone-700"
                value={form.roleLabel}
                onChange={(e) => setForm((f) => ({ ...f, roleLabel: e.target.value }))}
                placeholder="Agency contact, Introducer…"
              />
            </label>
            <label className="block text-sm">
              <span className="text-stone-500">Internal notes</span>
              <input
                className="mt-1 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-2 dark:border-stone-700"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  setFormErrors({});
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={() => void createPerson()} loading={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {assignOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4">
          <div className="absolute inset-0" onClick={() => setAssignOpen(false)} aria-hidden />
          <div className="relative z-10 max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-4 shadow-xl dark:border-stone-800 dark:bg-stone-950">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">Assign to lead</h2>
              <Button variant="ghost" size="sm" onClick={() => setAssignOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-stone-500">One lead can have multiple Lead Source people.</p>
            <label className="block text-sm">
              <span className="text-stone-500">Lead *</span>
              <select
                className="mt-1 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-2 dark:border-stone-700"
                value={assignClientId}
                onChange={(e) => setAssignClientId(e.target.value)}
              >
                <option value="">Select lead…</option>
                {assignClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.clientName}
                  </option>
                ))}
              </select>
            </label>
            <div className="block text-sm">
              <span className="text-stone-500">Lead Source people * (multi-select)</span>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-2 dark:border-stone-800">
                {activePeopleForAssign.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-900">
                      <input
                        type="checkbox"
                        checked={assignPersonIds.includes(p.id)}
                        onChange={() => toggleAssignPerson(p.id)}
                      />
                      <span>
                        {p.displayName}
                        {p.roleLabel ? (
                          <span className="text-stone-500"> · {p.roleLabel}</span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <label className="block text-sm">
              <span className="text-stone-500">Note (optional)</span>
              <input
                className="mt-1 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-2 dark:border-stone-700"
                value={assignNote}
                onChange={(e) => setAssignNote(e.target.value)}
                placeholder="Why linked"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={() => void saveAssign()}
                disabled={!assignClientId || assignPersonIds.length === 0}
                loading={saving}
              >
                {saving ? "Assigning…" : "Assign"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog
        open={Boolean(deactivateTarget)}
        title="Deactivate Lead Source person"
        description={
          deactivateTarget
            ? `Deactivate “${deactivateTarget.displayName}”. A reason is required and logged.`
            : "A reason is required and logged."
        }
        danger
        busy={saving}
        confirmLabel="Deactivate"
        onClose={closeDeactivate}
        onConfirm={() => void deactivatePerson()}
      >
        {(deactivateTarget?.leadCount ?? 0) > 0 ? (
          <div className="mb-4 space-y-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
            <p className="font-medium text-stone-800 dark:text-stone-100">
              This person has {deactivateTarget?.leadCount} linked lead
              {(deactivateTarget?.leadCount ?? 0) === 1 ? "" : "s"}.
            </p>
            <p className="text-stone-600 dark:text-stone-300">
              Choose what to do with those lead links:
            </p>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="deactivate-leads"
                className="mt-1"
                checked={deactivateLeadAction === "remove"}
                disabled={saving}
                onChange={() => setDeactivateLeadAction("remove")}
              />
              <span>
                <span className="font-medium">Remove</span> — unassign this person from all linked
                leads
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="deactivate-leads"
                className="mt-1"
                checked={deactivateLeadAction === "keep"}
                disabled={saving}
                onChange={() => setDeactivateLeadAction("keep")}
              />
              <span>
                <span className="font-medium">Keep</span> — leave lead links as they are
              </span>
            </label>
          </div>
        ) : null}
        <Label htmlFor="deactivate-reason">Reason</Label>
        <Textarea
          id="deactivate-reason"
          value={deactivateReason}
          disabled={saving}
          onChange={(e) => setDeactivateReason(e.target.value)}
          placeholder="Why is this person being deactivated?"
        />
        {deactivateError ? (
          <p className="mt-2 text-sm text-rose-700">{deactivateError}</p>
        ) : null}
      </Dialog>
      <ReasonDialog
        open={Boolean(unlinkTarget)}
        title="Unlink from lead"
        description={
          unlinkTarget
            ? `Remove this person from “${unlinkTarget.clientName}”. Reason is required and logged.`
            : "Reason is required and logged."
        }
        busy={saving}
        onClose={() => {
          if (saving) return;
          setUnlinkTarget(null);
        }}
        onConfirm={(reason) => {
          if (!unlinkTarget) return;
          void unlink(unlinkTarget.attributionId, reason);
        }}
      />
    </div>
  );
}
