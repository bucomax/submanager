import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { recordStaffLoginFailed, recordStaffLoginSuccess } from "@/infrastructure/audit/staff-login-audit";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * Hash descartável (cost 12, igual ao dos hashes reais) usado só para gastar o
 * mesmo tempo de CPU quando o e-mail não existe ou não tem senha — sem isso a
 * diferença de latência revela quais e-mails estão cadastrados.
 */
const DUMMY_PASSWORD_HASH = "$2a$12$xj6MdirVeyFWWlipr.PIi.oaDzgSVSsuv45DRop9zTXCfjVZwr9qu";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.user.findFirst({
          where: { email, deletedAt: null },
        });
        if (!user?.passwordHash) {
          await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
          if (user) {
            void recordStaffLoginFailed(email, "no_password", user.id).catch(() => undefined);
          }
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          void recordStaffLoginFailed(email, "invalid_credentials", user.id).catch(() => undefined);
          return null;
        }

        void recordStaffLoginSuccess(user.id).catch(() => undefined);

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
      }
      if (!token.userId && token.sub) {
        token.userId = token.sub;
      }
      const uid = (token.userId ?? user?.id ?? token.sub) as string | undefined;
      if (uid) {
        const row = await prisma.user.findFirst({
          where: { id: uid, deletedAt: null },
          select: { globalRole: true },
        });
        if (!row) {
          token.invalid = true;
          return token;
        }
        token.globalRole = row.globalRole;
        token.invalid = false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.invalid) {
        session.expires = new Date(0).toISOString();
        return session;
      }
      const userId = (token.userId ?? token.sub) as string | undefined;
      if (!session.user || !userId) return session;

      session.user.id = userId;
      session.user.globalRole = (token.globalRole as string) ?? "user";
      session.user.tenantId = null;
      session.user.tenantRole = null;
      session.user.tenantName = null;

      const row = await prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { activeTenantId: true, globalRole: true },
      });

      if (!row) return session;

      let activeTenantId = row.activeTenantId;

      // Auto-resolve: usuário sem activeTenantId mas com exatamente uma membership.
      // Cobre primeiro login pós-convite e contas legacy sem tenant ativo.
      if (!activeTenantId) {
        const memberships = await prisma.tenantMembership.findMany({
          where: { userId },
          select: { tenantId: true },
          take: 2,
        });
        if (memberships.length === 1) {
          activeTenantId = memberships[0]!.tenantId;
          await prisma.user
            .update({
              where: { id: userId },
              data: { activeTenantId },
            })
            .catch(() => undefined);
        }
      }

      if (!activeTenantId) return session;

      const membership = await prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId,
            tenantId: activeTenantId,
          },
        },
        include: {
          tenant: { select: { name: true } },
        },
      });

      if (membership) {
        session.user.tenantId = membership.tenantId;
        session.user.tenantRole = membership.role;
        session.user.tenantName = membership.tenant.name;
        return session;
      }

      if (row.globalRole === "super_admin") {
        session.user.tenantId = activeTenantId;
        session.user.tenantRole = null;
        const tenant = await prisma.tenant.findUnique({
          where: { id: activeTenantId },
          select: { name: true },
        });
        session.user.tenantName = tenant?.name ?? null;
      }

      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
