"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { loginAction } from "@/features/auth/actions";
import { AuthFormField } from "@/features/auth/components/auth-form-field";
import { Button } from "@/components/ui/button";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = await loginAction({ ...data, callbackUrl });
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          if (messages?.[0]) {
            setError(field as keyof LoginInput, { message: messages[0] });
          }
        }
      }
      if (result.formError) {
        setError("root", { message: result.formError });
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <AuthFormField
        id="email"
        label="Email"
        type="email"
        register={register("email")}
        error={errors.email?.message}
        autoComplete="email"
      />
      <AuthFormField
        id="password"
        label="Password"
        type="password"
        register={register("password")}
        error={errors.password?.message}
        autoComplete="current-password"
      />
      {errors.root?.message && (
        <p role="alert" aria-live="polite" className="text-negative text-sm">
          {errors.root.message}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
