"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { signupSchema, loginSchema } from "@/lib/validations/auth";
import { hashPassword } from "@/lib/password";
import { createUserWithWorkspace, EmailAlreadyRegisteredError } from "@/features/auth/server/service";

export interface AuthActionResult {
  formError?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export async function signupAction(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    await createUserWithWorkspace({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
    });
  } catch (err) {
    if (err instanceof EmailAlreadyRegisteredError) {
      return { fieldErrors: { email: [err.message] } };
    }
    throw err;
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      // Account was created but the immediate sign-in failed — send them to
      // log in manually rather than surfacing a confusing error.
      return { formError: "Account created. Please log in." };
    }
    throw err;
  }

  return {};
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

export async function loginAction(input: {
  email: string;
  password: string;
  callbackUrl?: string;
}): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: input.callbackUrl || "/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { formError: "Invalid email or password." };
    }
    throw err;
  }

  return {};
}
