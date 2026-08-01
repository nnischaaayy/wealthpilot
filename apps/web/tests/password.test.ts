import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("hashes and verifies a matching password", async () => {
    const hashed = await hashPassword("correcthorsebattery");
    expect(hashed).not.toBe("correcthorsebattery");
    await expect(verifyPassword(hashed, "correcthorsebattery")).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hashed = await hashPassword("correcthorsebattery");
    await expect(verifyPassword(hashed, "wrong-password")).resolves.toBe(false);
  });
});
