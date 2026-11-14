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
import { cn } from "@/lib/utils";

const PHONE_MAX = 15;
const EMAIL_MAX = 120;
const NAME_MAX = 80;

function sanitizeName(value: string) {
  return value.replace(/[^a-zA-Z0-9 .,&'\-]/g, "").slice(0, NAME_MAX);
}

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

function isValidPhone(value: string) {
  return /^\d{8,15}$/.test(value);
}

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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-rose-700">{message}</p>;
}

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
    const optionalPhone = z
      .string()
      .optional()
      .refine((v) => !v?.trim() || isValidPhone(sanitizePhone(v)), {
        message: "Enter a proper phone number (8–15 digits)",
      });
    const optionalEmail = z
      .string()
      .optional()
      .refine((v) => isValidEmail(v ?? ""), {
        message: "Enter a proper email address",
      });

    return z
      .object({
        clientName: z
          .string()
          .trim()
          .min(2, "Enter the client name (at least 2 characters)"),
        primaryPhone: z
          .string()
          .min(1, "Enter the primary phone number")
          .refine((v) => isValidPhone(sanitizePhone(v)), {
            message: "Enter a proper phone number (8–15 digits)",
          }),
        alternatePhone: optionalPhone,
        primaryEmail: optionalEmail,
        alternateEmail: optionalEmail,
        leadSourceId: z.string().min(1, "Select a lead source"),
        leadSourceOther: z.string().optional(),
        serviceId: z.string().min(1, "Select a service"),
        serviceOther: z.string().optional(),
        firstCallCompleted: z.enum(["yes", "no"]),
        decisionMakerPhone: optionalPhone,
        decisionMakerEmail: optionalEmail,
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
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      firstCallCompleted: "no",
      leadSourceId: "",
      serviceId: "",
      clientName: "",
      primaryPhone: "",
      alternatePhone: "",
      primaryEmail: "",
      alternateEmail: "",
    },
  });

  useEffect(() => {
    if (!config) return;
    const web = config.services.find((s) => s.slug === "web-development") ?? config.services[0];
    reset({
      firstCallCompleted: "no",
      leadSourceId: config.leadSources[0]?.id ?? "",
      serviceId: web?.id ?? "",
      clientName: "",
      primaryPhone: "",
      alternatePhone: "",
      primaryEmail: "",
      alternateEmail: "",
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

  const inputClass = (hasError?: boolean) =>
    cn(hasError && "border-rose-500 focus-visible:ring-rose-600");

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
        noValidate
        className="space-y-4 rounded-xl border bg-white/80 p-5 dark:border-stone-800 dark:bg-stone-950/60"
        onSubmit={handleSubmit(
          async (values) => {
            setSaving(true);
            try {
              void customValues;
              const client = await createClient({
                clientName: values.clientName.trim(),
                primaryPhone: sanitizePhone(values.primaryPhone),
                alternatePhone: values.alternatePhone
                  ? sanitizePhone(values.alternatePhone)
                  : undefined,
                primaryEmail: values.primaryEmail?.trim() || undefined,
                alternateEmail: values.alternateEmail?.trim() || undefined,
                leadSourceId: values.leadSourceId,
                leadSourceOther: values.leadSourceOther,
                serviceId: values.serviceId,
                serviceOther: values.serviceOther,
                firstCallCompleted: values.firstCallCompleted === "yes",
                decisionMakerPhone: values.decisionMakerPhone
                  ? sanitizePhone(values.decisionMakerPhone)
                  : undefined,
                decisionMakerEmail: values.decisionMakerEmail?.trim() || undefined,
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
          },
          (formErrors) => {
            const first =
              formErrors.clientName?.message ||
              formErrors.primaryPhone?.message ||
              formErrors.primaryEmail?.message ||
              formErrors.alternatePhone?.message ||
              formErrors.alternateEmail?.message ||
              formErrors.decisionMakerPhone?.message ||
              formErrors.decisionMakerEmail?.message ||
              formErrors.leadSourceOther?.message ||
              formErrors.serviceOther?.message ||
              formErrors.leadSourceId?.message ||
              formErrors.serviceId?.message;
            push(first ? String(first) : "Fix the highlighted fields and try again", "error");
          }
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Client name</Label>
            <Input
              className={inputClass(!!errors.clientName)}
              maxLength={NAME_MAX}
              placeholder="e.g. Acme Corp"
              {...register("clientName")}
              onChange={(e) => setValue("clientName", sanitizeName(e.target.value))}
            />
            <FieldError message={errors.clientName?.message} />
          </div>
          <div>
            <Label>Primary phone</Label>
            <Input
              className={inputClass(!!errors.primaryPhone)}
              inputMode="numeric"
              maxLength={PHONE_MAX}
              placeholder="8–15 digits"
              {...register("primaryPhone")}
              onChange={(e) => setValue("primaryPhone", sanitizePhone(e.target.value))}
            />
            <FieldError message={errors.primaryPhone?.message} />
          </div>
          <div>
            <Label>Alternate phone</Label>
            <Input
              className={inputClass(!!errors.alternatePhone)}
              inputMode="numeric"
              maxLength={PHONE_MAX}
              placeholder="Optional · 8–15 digits"
              {...register("alternatePhone")}
              onChange={(e) => setValue("alternatePhone", sanitizePhone(e.target.value))}
            />
            <FieldError message={errors.alternatePhone?.message} />
          </div>
          <div>
            <Label>Primary email</Label>
            <Input
              className={inputClass(!!errors.primaryEmail)}
              type="email"
              maxLength={EMAIL_MAX}
              placeholder="name@company.com"
              {...register("primaryEmail")}
              onChange={(e) => setValue("primaryEmail", sanitizeEmail(e.target.value))}
            />
            <FieldError message={errors.primaryEmail?.message} />
          </div>
          <div>
            <Label>Alternate email</Label>
            <Input
              className={inputClass(!!errors.alternateEmail)}
              type="email"
              maxLength={EMAIL_MAX}
              placeholder="Optional"
              {...register("alternateEmail")}
              onChange={(e) => setValue("alternateEmail", sanitizeEmail(e.target.value))}
            />
            <FieldError message={errors.alternateEmail?.message} />
          </div>
          <div>
            <Label>Lead source</Label>
            <select
              className={cn(
                "h-10 w-full rounded-md border px-3 text-sm",
                errors.leadSourceId && "border-rose-500"
              )}
              {...register("leadSourceId")}
            >
              {config.leadSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <FieldError message={errors.leadSourceId?.message} />
          </div>
          {sourceAllowsOther ? (
            <div className="md:col-span-2">
              <Label>Please describe this other lead source</Label>
              <Input
                className={inputClass(!!errors.leadSourceOther)}
                placeholder="Briefly explain where this lead came from"
                {...register("leadSourceOther")}
              />
              <FieldError message={errors.leadSourceOther?.message} />
            </div>
          ) : null}
          <div>
            <Label>Service</Label>
            <select
              className={cn(
                "h-10 w-full rounded-md border px-3 text-sm",
                errors.serviceId && "border-rose-500"
              )}
              {...register("serviceId")}
            >
              {config.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <FieldError message={errors.serviceId?.message} />
          </div>
          {serviceAllowsOther ? (
            <div className="md:col-span-2">
              <Label>Please describe this other service</Label>
              <Input
                className={inputClass(!!errors.serviceOther)}
                placeholder="Briefly explain what the client needs"
                {...register("serviceOther")}
              />
              <FieldError message={errors.serviceOther?.message} />
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
                <Input
                  className={inputClass(!!errors.decisionMakerPhone)}
                  inputMode="numeric"
                  maxLength={PHONE_MAX}
                  placeholder="Optional · 8–15 digits"
                  {...register("decisionMakerPhone")}
                  onChange={(e) => setValue("decisionMakerPhone", sanitizePhone(e.target.value))}
                />
                <FieldError message={errors.decisionMakerPhone?.message} />
              </div>
              <div>
                <Label>Decision-maker email</Label>
                <Input
                  className={inputClass(!!errors.decisionMakerEmail)}
                  type="email"
                  maxLength={EMAIL_MAX}
                  placeholder="Optional"
                  {...register("decisionMakerEmail")}
                  onChange={(e) => setValue("decisionMakerEmail", sanitizeEmail(e.target.value))}
                />
                <FieldError message={errors.decisionMakerEmail?.message} />
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
