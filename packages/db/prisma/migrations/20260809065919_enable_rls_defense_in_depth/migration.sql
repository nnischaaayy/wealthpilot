-- Row-level security as defense-in-depth (architecture.md §14) — a second,
-- database-enforced layer behind the app-layer workspaceId filtering that's
-- the actual, tested primary defense (every service function's
-- findFirst({id, workspaceId}) chokepoint; apps/web/tests/integration/
-- tenant-isolation.test.ts; apps/ai-service's equivalent Postgres tests).
--
-- Policies check current_setting('app.workspace_id', true), set per-query by
-- packages/db's forWorkspace() helper. Deliberately NOT using
-- FORCE ROW LEVEL SECURITY here: the app connects as the tables' owning
-- role, and table owners bypass RLS unless forced. Enabling without forcing
-- is a genuine no-op today (zero behavior change) that makes the policies
-- real and ready — forcing them is a follow-up step that needs the app (both
-- apps/web's Prisma queries AND apps/ai-service's asyncpg queries) migrated
-- to route every workspace-scoped query through a session-variable-setting
-- wrapper first, and ideally a separate, non-owning, restricted DB role for
-- the app's connections (the standard Postgres RLS production pattern) —
-- both larger changes than fit safely alongside the rest of this phase.
CREATE OR REPLACE FUNCTION set_workspace_policy(table_name text) RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format(
    'CREATE POLICY tenant_isolation ON %I USING ("workspaceId" = current_setting(''app.workspace_id'', true)) WITH CHECK ("workspaceId" = current_setting(''app.workspace_id'', true))',
    table_name
  );
END;
$$ LANGUAGE plpgsql;

SELECT set_workspace_policy('accounts');
SELECT set_workspace_policy('transactions');
SELECT set_workspace_policy('category_rules');
SELECT set_workspace_policy('upload_jobs');
SELECT set_workspace_policy('holdings');
SELECT set_workspace_policy('category_budgets');
SELECT set_workspace_policy('audit_logs');
SELECT set_workspace_policy('workspace_members');

DROP FUNCTION set_workspace_policy(text);
