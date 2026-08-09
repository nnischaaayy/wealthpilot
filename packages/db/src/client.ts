import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = global.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

/**
 * Row-level-security-aware client (architecture.md §14 defense-in-depth).
 * Sets the `app.workspace_id` session variable the RLS policies (migration
 * 20260809065919_enable_rls_defense_in_depth) check, scoped to a single
 * transaction per Prisma's documented RLS extension pattern.
 *
 * Not yet the default for every query: the local dev Postgres role
 * (`wealthpilot`) is a superuser, and superusers unconditionally bypass RLS
 * regardless of this — verified manually against a temporary restricted
 * role (see the migration's comment and the Phase 8 commit message for the
 * verification transcript). The policies themselves are real and correct;
 * making them actually load-bearing in production needs the app to connect
 * as a non-superuser, non-BYPASSRLS role (the standard Postgres RLS
 * deployment pattern) and every workspace-scoped query routed through this
 * helper — a larger rollout intentionally left as follow-up work rather
 * than a rushed, undertested change across every service file. Use this for
 * new call sites where you want the belt-and-braces defense today.
 */
export function forWorkspace(workspaceId: string) {
  async function withSessionVar<T>(query: (args: unknown) => T, args: unknown): Promise<T> {
    const [, result] = await prisma.$transaction([
      prisma.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`,
      query(args) as never,
    ]);
    return result as T;
  }

  return prisma.$extends({
    query: {
      // $allModels/$allOperations covers every model method (findMany,
      // create, update, ...) — the shape every service function uses.
      $allModels: {
        $allOperations: ({ args, query }) => withSessionVar(query, args),
      },
      // Model-level interception doesn't cover top-level $queryRaw/
      // $executeRaw — those need their own hooks.
      $queryRaw: ({ args, query }) => withSessionVar(query, args),
      $queryRawUnsafe: ({ args, query }) => withSessionVar(query, args),
      $executeRaw: ({ args, query }) => withSessionVar(query, args),
      $executeRawUnsafe: ({ args, query }) => withSessionVar(query, args),
    },
  });
}

export * from "@prisma/client";
