import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@wealthpilot/db";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/lib/password";
import { getOrCreateOAuthUser, recordLoginAudit } from "@/features/auth/server/service";

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 min "access" claim
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 day session cookie ("refresh" boundary)

const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

const config: NextAuthConfig = {
  session: { strategy: "jwt", maxAge: SESSION_TTL_SECONDS },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        if (!user?.passwordHash) return null;

        const valid = await verifyPassword(user.passwordHash, parsed.data.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    ...(googleConfigured ? [Google] : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const { userId, workspaceId } = await getOrCreateOAuthUser({
          name: user.name ?? user.email,
          email: user.email,
        });
        await recordLoginAudit(userId, workspaceId);
        user.id = userId;
        return true;
      }

      if (account?.provider === "credentials" && user.id) {
        const membership = await prisma.workspaceMember.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "asc" },
        });
        if (membership) await recordLoginAudit(user.id, membership.workspaceId);
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.accessTokenExpires = Date.now() + ACCESS_TOKEN_TTL_MS;
        return token;
      }

      // Past the short-lived access window: re-validate the user still
      // exists before extending it, rather than blindly trusting a
      // days-old claim for the remainder of the 7-day session cookie.
      if (typeof token.accessTokenExpires === "number" && Date.now() > token.accessTokenExpires) {
        if (typeof token.userId === "string") {
          const stillExists = await prisma.user.findUnique({ where: { id: token.userId } });
          if (!stillExists) {
            return { ...token, userId: undefined };
          }
        }
        token.accessTokenExpires = Date.now() + ACCESS_TOKEN_TTL_MS;
      }

      return token;
    },
    async session({ session, token }) {
      if (typeof token.userId === "string") session.user.id = token.userId;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
