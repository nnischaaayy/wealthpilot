import { describe, expect, it } from "vitest";
import { forWorkspace, prisma } from "@wealthpilot/db";
import { createTestWorkspace, cleanupWorkspace } from "./helpers";

// forWorkspace() is the mechanism the RLS defense-in-depth policies
// (migration 20260809065919_enable_rls_defense_in_depth) rely on. The
// policies themselves can't be exercised here — the local dev/CI Postgres
// role is a superuser and unconditionally bypasses RLS, which was verified
// manually against a temporary restricted role (see that migration's
// comment). This test instead proves the mechanism itself: the session
// variable really gets set, really is transaction-scoped, and really
// doesn't leak to queries made outside forWorkspace().
describe("forWorkspace() session-variable mechanism (live Postgres)", () => {
  it("sets app.workspace_id for the scoped client's query", async () => {
    const { workspace } = await createTestWorkspace("rls-mechanism");
    try {
      const scoped = forWorkspace(workspace.id);
      const [{ current }] = await scoped.$queryRaw<[{ current: string | null }]>`
        SELECT current_setting('app.workspace_id', true) AS current
      `;
      expect(current).toBe(workspace.id);
    } finally {
      await cleanupWorkspace(workspace.id);
    }
  });

  it("does not leak the session variable to the unscoped default client", async () => {
    const { workspace } = await createTestWorkspace("rls-mechanism-leak");
    try {
      const scoped = forWorkspace(workspace.id);
      await scoped.$queryRaw`SELECT current_setting('app.workspace_id', true)`;

      const [{ current }] = await prisma.$queryRaw<[{ current: string | null }]>`
        SELECT current_setting('app.workspace_id', true) AS current
      `;
      expect(current).not.toBe(workspace.id);
    } finally {
      await cleanupWorkspace(workspace.id);
    }
  });

  it("scopes to the workspace passed for that call, not a previous one", async () => {
    const a = await createTestWorkspace("rls-mechanism-a");
    const b = await createTestWorkspace("rls-mechanism-b");
    try {
      await forWorkspace(a.workspace.id).$queryRaw`SELECT 1`;

      const [{ current }] = await forWorkspace(b.workspace.id).$queryRaw<[{ current: string | null }]>`
        SELECT current_setting('app.workspace_id', true) AS current
      `;
      expect(current).toBe(b.workspace.id);
    } finally {
      await cleanupWorkspace(a.workspace.id);
      await cleanupWorkspace(b.workspace.id);
    }
  });
});
