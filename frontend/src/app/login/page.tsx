"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/mock-services/auth";
import { useToast } from "@/components/toast";
import { MOCK_PASSWORD } from "@/mock-data/store";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { push } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "siva@viximate.local", password: MOCK_PASSWORD },
  });

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_20%_20%,#cfe8df,transparent_40%),linear-gradient(160deg,#f4efe6,#e7eee9)] p-4 dark:bg-[radial-gradient(circle_at_20%_20%,#16352f,transparent_40%),linear-gradient(160deg,#101010,#18201d)]">
      <form
        onSubmit={handleSubmit((values) => {
          try {
            login(values.email, values.password);
            push("Signed in (mock mode)");
            router.push("/dashboard");
          } catch (err) {
            push(err instanceof Error ? err.message : "Login failed", "error");
          }
        })}
        className="w-full max-w-md rounded-2xl border border-stone-200/80 bg-white/90 p-8 shadow-lg backdrop-blur dark:border-stone-800 dark:bg-stone-950/80"
      >
        <p className="font-display text-3xl text-teal-900 dark:text-teal-200">Viximate</p>
        <p className="mt-1 text-sm text-stone-500">Internal CRM · Mock authentication</p>
        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email ? <p className="mt-1 text-xs text-rose-700">{errors.email.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register("password")} />
          </div>
        </div>
        <Button className="mt-6 w-full" disabled={isSubmitting}>
          Sign in
        </Button>
        <p className="mt-4 text-center text-sm text-stone-600">
          <Link href="/forgot-password" className="text-teal-800 underline dark:text-teal-300">
            Forgot password
          </Link>
        </p>
        <p className="mt-4 rounded-md bg-stone-100 p-3 text-xs text-stone-600 dark:bg-stone-900 dark:text-stone-300">
          Demo: siva@viximate.local / {MOCK_PASSWORD}
        </p>
      </form>
    </div>
  );
}
