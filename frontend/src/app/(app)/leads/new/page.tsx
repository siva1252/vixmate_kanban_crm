"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CUSTOM_FIELDS, LEAD_SOURCES, SERVICES } from "@/mock-data/store";
import { createClient } from "@/mock-services/clients";
import { getSession } from "@/mock-services/auth";
import { useToast } from "@/components/toast";

const schema = z
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
    const source = LEAD_SOURCES.find((s) => s.id === values.leadSourceId);
    const service = SERVICES.find((s) => s.id === values.serviceId);
    if (source?.allowsOtherText && !values.leadSourceOther?.trim()) {
      ctx.addIssue({ code: "custom", path: ["leadSourceOther"], message: "Specify the source" });
    }
    if (service?.allowsOtherText && !values.serviceOther?.trim()) {
      ctx.addIssue({ code: "custom", path: ["serviceOther"], message: "Specify the service" });
    }
  });

type FormValues = z.infer<typeof schema>;

export default function CreateLeadPage() {
  const router = useRouter();
  const { push } = useToast();
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstCallCompleted: "no",
      leadSourceId: LEAD_SOURCES[0].id,
      serviceId: SERVICES[5].id,
    },
  });

  const firstCall = watch("firstCallCompleted");
  const sourceId = watch("leadSourceId");
  const serviceId = watch("serviceId");
  const sourceAllowsOther = useMemo(
    () => LEAD_SOURCES.find((s) => s.id === sourceId)?.allowsOtherText,
    [sourceId]
  );
  const serviceAllowsOther = useMemo(
    () => SERVICES.find((s) => s.id === serviceId)?.allowsOtherText,
    [serviceId]
  );
  const postCallFields = CUSTOM_FIELDS.filter((f) => f.showOnPostFirstCall);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-3xl">Create lead</h1>
      <form
        className="space-y-4 rounded-xl border bg-white/80 p-5 dark:border-stone-800 dark:bg-stone-950/60"
        onSubmit={handleSubmit((values) => {
          const session = getSession();
          if (!session) return;
          const client = createClient(
            {
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
              customFields: customValues,
            },
            session.teamMemberId
          );
          push("Lead created");
          router.push(`/leads/${client.id}`);
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
              {LEAD_SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {sourceAllowsOther ? (
            <div>
              <Label>Specify source</Label>
              <Input {...register("leadSourceOther")} />
            </div>
          ) : null}
          <div>
            <Label>Service</Label>
            <select className="h-10 w-full rounded-md border px-3 text-sm" {...register("serviceId")}>
              {SERVICES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {serviceAllowsOther ? (
            <div>
              <Label>Specify service</Label>
              <Input {...register("serviceOther")} />
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
                  {field.fieldType === "dropdown" ? (
                    <select
                      className="h-10 w-full rounded-md border px-3 text-sm"
                      onChange={(e) =>
                        setCustomValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    >
                      <option value="">Select</option>
                      {(field.choices ?? []).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : field.fieldType === "boolean" ? (
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

        <Button type="submit">Save lead</Button>
      </form>
    </div>
  );
}
