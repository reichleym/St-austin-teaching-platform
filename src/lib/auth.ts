import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

type LoginAudience = "SUPER_ADMIN" | "USER";

function normalizeRole(role: string | Role | null | undefined): Role {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return Role.SUPER_ADMIN;
  if (role === "TEACHER") return Role.TEACHER;
  return Role.STUDENT;
}

function normalizeStatus(status: string | UserStatus | null | undefined): UserStatus {
  if (status === "ACTIVE") return UserStatus.ACTIVE;
  return UserStatus.DISABLED;
}

async function authorizeCredentials(
  credentials: Record<"email" | "password" | "loginAs", string> | undefined,
  audience: LoginAudience
) {
  if (!credentials?.email || !credentials?.password) {
    return null;
  }

  try {
    const result = await prisma.$queryRaw<
      Array<{
        id: string;
        email: string;
        name: string | null;
        image: string | null;
        passwordHash: string;
        role: string;
        status: string;
      }>
    >`SELECT "id","email","name","image","passwordHash","role"::text AS "role","status"::text AS "status" FROM "User" WHERE "email" = ${credentials.email.toLowerCase()} LIMIT 1`;
    
    if (!result || result.length === 0) {
      return null;
    }
    
    const user = result[0];

    if (!user || user.status !== "ACTIVE") {
      return null;
    }

    const valid = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!valid) {
      return null;
    }

    const roleText = String(user.role);

    if (audience === "SUPER_ADMIN" && roleText !== "SUPER_ADMIN" && roleText !== "ADMIN") {
      return null;
    }

    if (audience === "USER" && (roleText === "SUPER_ADMIN" || roleText === "ADMIN")) {
      return null;
    }

    if (audience === "USER" && credentials.loginAs) {
      const targetRoleText = credentials.loginAs === "TEACHER" ? "TEACHER" : "STUDENT";
      if (roleText !== targetRoleText) {
        return null;
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: normalizeRole(user.role),
      status: normalizeStatus(user.status),
    };
  } catch (error) {
    console.error("Authorization error:", error);
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      id: "super-admin-credentials",
      name: "Super Admin Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        loginAs: { label: "Login as", type: "text" },
      },
      authorize: (credentials) =>
        authorizeCredentials(
          credentials as Record<"email" | "password" | "loginAs", string> | undefined,
          "SUPER_ADMIN"
        ),
    }),
    CredentialsProvider({
      id: "admin-credentials",
      name: "Admin Credentials (Legacy)",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        loginAs: { label: "Login as", type: "text" },
      },
      authorize: (credentials) =>
        authorizeCredentials(
          credentials as Record<"email" | "password" | "loginAs", string> | undefined,
          "SUPER_ADMIN"
        ),
    }),
    CredentialsProvider({
      id: "user-credentials",
      name: "User Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        loginAs: { label: "Login as", type: "text" },
      },
      authorize: (credentials) =>
        authorizeCredentials(
          credentials as Record<"email" | "password" | "loginAs", string> | undefined,
          "USER"
        ),
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = normalizeRole(user.role as string | Role);
        token.status = normalizeStatus(user.status as string | UserStatus);
      }

      if ((!token.role || !token.status) && token.sub) {
        try {
          const dbUsers = await prisma.$queryRaw<Array<{ role: string; status: string }>>`
            SELECT "role"::text AS "role","status"::text AS "status" FROM "User" WHERE "id" = ${token.sub} LIMIT 1
          `;
          const dbUser = dbUsers[0];
          token.role = normalizeRole(dbUser?.role);
          token.status = normalizeStatus(dbUser?.status);
        } catch (error) {
          console.error("JWT callback error:", error);
          token.role = Role.STUDENT;
          token.status = UserStatus.DISABLED;
        }
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = normalizeRole(token.role as string | Role | undefined);
        session.user.status = normalizeStatus(token.status as string | UserStatus | undefined);
      }
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}
