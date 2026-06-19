import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";
import { db } from "./db";
import { verifyPassword } from "./password";
import { authLimiter } from "./rate-limit";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function normalizeRole(role: string | null | undefined) {
  return role === "ADMIN" ? "ADMIN" : "USER";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // ── 速率限制（按 email 追踪，防单账户暴力破解） ──
        if (!await authLimiter.check(`login:${parsed.data.email.toLowerCase()}`)) {
          throw new Error("RATE_LIMITED");
        }

        const user = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user?.passwordHash || user.disabledAt) return null;

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: normalizeRole(user.role),
          disabledAt: user.disabledAt,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.disabledAt = user.disabledAt ? user.disabledAt.toISOString() : null;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = String(token.id);
        session.user.role = token.role === "ADMIN" ? "ADMIN" : "USER";
        session.user.disabledAt = token.disabledAt ? new Date(String(token.disabledAt)) : null;
      }
      return session;
    },
  },
});
