import { describe, expect, it } from "vitest";
import { signupSchema, loginSchema } from "@/lib/validations/auth";

describe("signupSchema", () => {
  it("accepts a valid signup payload", () => {
    const result = signupSchema.safeParse({
      name: "Priya",
      email: "Priya@Example.com",
      password: "correcthorsebattery",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("priya@example.com");
  });

  it("rejects a short password", () => {
    const result = signupSchema.safeParse({
      name: "Priya",
      email: "priya@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = signupSchema.safeParse({
      name: "Priya",
      email: "not-an-email",
      password: "correcthorsebattery",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = signupSchema.safeParse({
      name: "  ",
      email: "priya@example.com",
      password: "correcthorsebattery",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "priya@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});
