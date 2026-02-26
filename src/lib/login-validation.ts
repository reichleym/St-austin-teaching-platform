import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type LoginAudience = "SUPER_ADMIN" | "USER";

export type LoginFailureCode =
  | "MISSING_CREDENTIALS"
  | "INVALID_CREDENTIALS"
  | "INACTIVE_ACCOUNT"
  | "INCORRECT_USER_TYPE"
  | "EMAIL_NOT_VERIFIED";

type LoginInput = {
  email?: string;
  password?: string;
  loginAs?: string;
  audience: LoginAudience;
};

type LoginUserRecord = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  passwordHash: string;
  role: string;
  status: string;
  emailVerified: Date | null;
};

export type LoginEvaluation =
  | { ok: true; user: LoginUserRecord }
  | { ok: false; code: LoginFailureCode };

export async function evaluateLoginAttempt(input: LoginInput): Promise<LoginEvaluation> {
  const email = input.email?.toLowerCase().trim() ?? "";
  const password = input.password ?? "";

  if (!email || !password) {
    return { ok: false, code: "MISSING_CREDENTIALS" };
  }

  const result = await prisma.$queryRaw<LoginUserRecord[]>`
    SELECT "id","email","name","image","passwordHash","role"::text AS "role","status"::text AS "status","emailVerified"
    FROM "User"
    WHERE "email" = ${email}
    LIMIT 1
  `;

  const user = result[0];
  if (!user) {
    return { ok: false, code: "INVALID_CREDENTIALS" };
  }

  if (user.status !== "ACTIVE") {
    return { ok: false, code: "INACTIVE_ACCOUNT" };
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    return { ok: false, code: "INVALID_CREDENTIALS" };
  }

  const roleText = String(user.role);

  if (input.audience === "SUPER_ADMIN") {
    if (roleText !== "SUPER_ADMIN" && roleText !== "ADMIN") {
      return { ok: false, code: "INCORRECT_USER_TYPE" };
    }
  }

  if (input.audience === "USER") {
    if (roleText === "SUPER_ADMIN" || roleText === "ADMIN") {
      return { ok: false, code: "INCORRECT_USER_TYPE" };
    }

    if (input.loginAs) {
      const targetRoleText = input.loginAs === "TEACHER" ? "TEACHER" : "STUDENT";
      if (roleText !== targetRoleText) {
        return { ok: false, code: "INCORRECT_USER_TYPE" };
      }
    }

    if (roleText === "STUDENT" && !user.emailVerified) {
      return { ok: false, code: "EMAIL_NOT_VERIFIED" };
    }
  }

  return { ok: true, user };
}
