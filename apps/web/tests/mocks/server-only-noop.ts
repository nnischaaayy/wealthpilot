// Stub for the "server-only" package in tests. The real package throws
// unconditionally on import (it's a webpack/Next.js build-time guard, not a
// runtime check) — see vitest.config.ts's resolve.alias.
export {};
