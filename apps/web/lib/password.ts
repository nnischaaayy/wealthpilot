import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended Argon2id parameters (memoryCost in KiB). `algorithm: 2` is
// Argon2id — referenced by value because @node-rs/argon2's `Algorithm` const
// enum can't be accessed under isolatedModules.
const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}
