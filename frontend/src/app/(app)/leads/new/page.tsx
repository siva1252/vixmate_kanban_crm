"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CUSTOM_FIELDS } from "@/mock-data/store";
import { createClient } from "@/services/clients";
import { fetchCrmConfig, type CrmConfig } from "@/services/configuration";
import { ApiError } from "@/lib/api";
import { cacheGet } from "@/lib/api-cache";
import { useToast } from "@/components/toast";

type FormValues = {
  clientName: string;
  primaryPhone: string;
  alternatePhone?: string;
  primaryEmail?: string;
  alternateEmail?: string;
  leadSourceId: string;
  leadSourceOther?: string;
  serviceId: string;
  serviceOther?: string;
  firstCallCompleted: "yes" | "no";
  decisionMakerPhone?: string;
  decisionMakerEmail?: string;
  estimatedDealValue?: string;
  clientRequirements?: string;
  callDiscussionNotes?: string;
  firstCallNotes?: string;
};

export default function CreateLeadPage() {
  const router = useRouter();
  const { push } = useToast();
  const [config, setConfig] = useState<CrmConfig | null>(() => cacheGet<CrmConfig>("config:bundle"));
  const [loadingConfig, setLoadingConfig] = useState(() => !cacheGet("config:bundle"));
  const [saving, setSaving] = useState(false);
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    const ac = new AbortController();
    void fetchCrmConfig(ac.signal)
      .then((c) => {
        if (!ac.signal.aborted) setConfig(c);
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        push(err instanceof ApiError ? err.message : "Failed to load form options", "error");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoadingConfig(false);
      });
    return () => ac.abort();
  }, [push]);

  const schema = useMemo(() => {
    const sources = config?.leadSources ?? [];
    const services = config?.services ?? [];
    return z
      .object({
        clientName: z.string().min(2),
        primaryPhone: z.string().min(5),
        alternatePhone: z.string().optional(),
        primaryEmail: z.string().email().optional().or(z.literal("")),
        alternateEmail: z.string().email().optional().or(z.literal("")),
        leadSourceId: z.string().min(1),
        leadSourceOther: z.string().optional(),
        serviceId: z.string().min(1),
        serviceOther: z.string().optional(),
        firstCallCompleted: z.enum(["yes", "no"]),
        decisionMakerPhone: z.string().optional(),
        decisionMakerEmail: z.string().optional(),
        estimatedDealValue: z.string().optional(),
        clientRequirements: z.string().optional(),
        callDiscussionNotes: z.string().optional(),
        firstCallNotes: z.string().optional(),
      })
      .superRefine((values, ctx) => {
        const source = sources.find((s) => s.id === values.leadSourceId);
        const service = services.find((s) => s.id === values.serviceId);
        if (source?.allowsOtherText && !values.leadSourceOther?.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["leadSourceOther"],
            message: "Please briefly explain this other lead source",
          });
        }
        if (service?.allowsOtherText && !values.serviceOther?.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["serviceOther"],
            message: "Please briefly explain this other service",
          });
        }
      });
  }, [config]);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstCallCompleted: "no",
      leadSourceId: "",
      serviceId: "",
    },
  });

  useEffect(() => {
    if (!config) return;
    const web = config.services.find((s) => s.slug === "web-development") ?? config.services[0];
    reset({
      firstCallCompleted: "no",
      leadSourceId: config.leadSources[0]?.id ?? "",
      serviceId: web?.id ?? "",
    });
  }, [config, reset]);

  const firstCall = watch("firstCallCompleted");
  const sourceId = watch("leadSourceId");
  const serviceId = watch("serviceId");
  const sourceAllowsOther = useMemo(
    () => config?.leadSources.find((s) => s.id === sourceId)?.allowsOtherText,
    [config, sourceId]
  );
  const serviceAllowsOther = useMemo(
    () => config?.services.find((s) => s.id === serviceId)?.allowsOtherText,
    [config, serviceId]
  );
  const postCallFields = CUSTOM_FIELDS.filter((f) => f.showOnPostFirstCall);

  if (loadingConfig) {
    return <p className="p-6 text-stone-500">Loading form…</p>;
  }

  if (!config || !config.leadSources.length || !config.services.length) {
    return <p className="p-6 text-rose-700">Configuration missing. Seed backend configuration and retry.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-4 md:p-6">
      <h1 className="font-display text-3xl">Create lead</h1>
      <form
        className="space-y-4 rounded-xl border bg-white/80 p-5 dark:border-stone-800 dark:bg-stone-950/60"
        onSubmit={handleSubmit(async (values) => {
          setSaving(true);
          try {
            void customValues;
            const client = await createClient({
              clientName: values.clientName,
              primaryPhone: values.primaryPhone,
              alternatePhone: values.alternatePhone,
              primaryEmail: values.primaryEmail,
              alternateEmail: values.alternateEmail,
              leadSourceId: values.leadSourceId,
              leadSourceOther: values.leadSourceOther,
              serviceId: values.serviceId,
              serviceOther: values.serviceOther,
              firstCallCompleted: values.firstCallCompleted === "yes",
              decisionMakerPhone: values.decisionMakerPhone,
              decisionMakerEmail: values.decisionMakerEmail,
              estimatedDealValue: values.estimatedDealValue
                ? Number(values.estimatedDealValue)
                : undefined,
              clientRequirements: values.clientRequirements,
              callDiscussionNotes: values.callDiscussionNotes,
              firstCallNotes: values.firstCallNotes,
            });
            push("Lead created");
            router.push(`/leads/${client.id}`);
          } catch (err) {
            push(err instanceof ApiError ? err.message : "Failed to create lead", "error");
          } finally {
            setSaving(false);
          }
        })}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Client name</Label>
            <Input {...register("clientName")} />
            {errors.clientName ? <p className="text-xs text-rose-700">{errors.clientName.message}</p> : null}
          </div>
          <div>
            <Label>Primary phone</Label>
            <Input {...register("primaryPhone")} />
          </div>
          <div>
            <Label>Alternate phone</Label>
            <Input {...register("alternatePhone")} />
          </div>
          <div>
            <Label>Primary email</Label>
            <Input {...register("primaryEmail")} />
          </div>
          <div>
            <Label>Lead source</Label>
            <select className="h-10 w-full rounded-md border px-3 text-sm" {...register("leadSourceId")}>
              {config.leadSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {sourceAllowsOther ? (
            <div className="md:col-span-2">
              <Label>Please describe this other lead source</Label>
              <Input
                placeholder="Briefly explain where this lead came from"
                {...register("leadSourceOther")}
              />
              {errors.leadSourceOther ? (
                <p className="text-xs text-rose-700">{errors.leadSourceOther.message}</p>
              ) : null}
            </div>
          ) : null}
          <div>
            <Label>Service</Label>
            <select className="h-10 w-full rounded-md border px-3 text-sm" {...register("serviceId")}>
              {config.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {serviceAllowsOther ? (
            <div className="md:col-span-2">
              <Label>Please describe this other service</Label>
              <Input placeholder="Briefly explain what the client needs" {...register("serviceOther")} />
              {errors.serviceOther ? (
                <p className="text-xs text-rose-700">{errors.serviceOther.message}</p>
              ) : null}
            </div>
          ) : null}
          <div>
            <Label>Has the first call been completed?</Label>
            <select className="h-10 w-full rounded-md border px-3 text-sm" {...register("firstCallCompleted")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>

        {firstCall === "yes" ? (
          <div className="space-y-3 rounded-lg border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-900 dark:bg-teal-950/20">
            <h2 className="font-medium">Post-call information</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Decision-maker phone</Label>
                <Input {...register("decisionMakerPhone")} />
              </div>
              <div>
                <Label>Decision-maker email</Label>
                <Input {...register("decisionMakerEmail")} />
              </div>
              <div>
                <Label>Estimated deal value</Label>
                <Input {...register("estimatedDealValue")} />
              </div>
              <div className="md:col-span-2">
                <Label>Client requirements</Label>
                <Textarea {...register("clientRequirements")} />
              </div>
              <div className="md:col-span-2">
                <Label>Call discussion notes</Label>
                <Textarea {...register("callDiscussionNotes")} />
              </div>
              <div className="md:col-span-2">
                <Label>First call notes</Label>
                <Textarea {...register("firstCallNotes")} />
              </div>
              {postCallFields.map((field) => (
                <div key={field.id}>
                  <Label>{field.label}</Label>
                  {field.fieldType === "boolean" ? (
                    <select
                      className="h-10 w-full rounded-md border px-3 text-sm"
                      onChange={(e) =>
                        setCustomValues((prev) => ({
                          ...prev,
                          [field.key]: e.target.value === "true",
                        }))
                      }
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  ) : (
                    <Input
                      onChange={(e) =>
                        setCustomValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <Button type="submit" loading={saving}>
          {saving ? "Saving…" : "Save lead"}
        </Button>
      </form>
    </div>
  );
}
