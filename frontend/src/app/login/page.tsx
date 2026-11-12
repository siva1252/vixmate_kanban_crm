"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { login } from "@/mock-services/auth";
import { useToast } from "@/components/toast";
import { ApiError } from "@/lib/api";

const schema = z.object({
  email: z.string().email("Enter a valid work email"),
  password: z.string().min(1, "Password is required"),
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
    defaultValues: { email: "", password: "" },
  });

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_20%_20%,#cfe8df,transparent_40%),linear-gradient(160deg,#f4efe6,#e7eee9)] p-4 dark:bg-[radial-gradient(circle_at_20%_20%,#16352f,transparent_40%),linear-gradient(160deg,#101010,#18201d)]">
      <form
        onSubmit={handleSubmit(async (values) => {
          try {
            await login(values.email, values.password);
            push("Signed in");
            router.replace("/dashboard");
          } catch (err) {
            const message =
              err instanceof ApiError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : "Login failed";
            push(message, "error");
          }
        })}
        className="w-full max-w-md rounded-2xl border border-stone-200/80 bg-white/90 p-8 shadow-lg backdrop-blur dark:border-stone-800 dark:bg-stone-950/80"
      >
        <div className="flex items-center gap-3">
          <span className="relative inline-flex h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black shadow-sm ring-1 ring-stone-900/10">
            <Image
              src="/brand/viximate-logo.png"
              alt="Viximate"
              width={48}
              height={48}
              className="h-full w-full object-cover"
              priority
            />
          </span>
          <div>
            <p className="font-display text-3xl text-teal-900 dark:text-teal-200">Viximate</p>
            <p className="mt-0.5 text-sm text-stone-500">Internal CRM</p>
          </div>
        </div>
        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@viximate.com"
              {...register("email")}
            />
            {errors.email ? <p className="mt-1 text-xs text-rose-700">{errors.email.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password ? (
              <p className="mt-1 text-xs text-rose-700">{errors.password.message}</p>
            ) : null}
          </div>
        </div>
        <Button className="mt-6 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
        <p className="mt-4 text-center text-sm text-stone-600">
          <Link href="/forgot-password" className="text-teal-800 underline dark:text-teal-300">
            Forgot password
          </Link>
        </p>
      </form>
    </div>
  );
}
