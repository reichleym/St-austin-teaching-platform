import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Body = {
  email?: string;
  token?: string;
  newPassword?: string;
};

async function ensurePasswordResetSchema() {
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_user_created_idx" ON "PasswordResetToken"("userId","createdAt");
  `);
}

export async function POST(request: NextRequest) {
  try {
    await ensurePasswordResetSchema();
    const body = (await request.json()) as Body;
    const email = body.email?.toLowerCase().trim() ?? "";
    const token = body.token?.trim() ?? "";
    const newPassword = body.newPassword?.trim() ?? "";

    if (!email || !token || !newPassword) {
      return NextResponse.json({ error: "email, token and newPassword are required." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const rows = await prisma.$queryRaw<
      Array<{ id: string; userId: string; email: string; role: string; status: string }>
    >`
      SELECT t."id", t."userId", u."email", u."role"::text AS "role", u."status"::text AS "status"
      FROM "PasswordResetToken" t
      JOIN "User" u ON u."id" = t."userId"
      WHERE (t."tokenHash" = ${tokenHash} OR t."tokenHash" = ${token})
        AND t."usedAt" IS NULL
        AND t."expiresAt" > NOW()
      ORDER BY t."createdAt" DESC
      LIMIT 1
    `;
    const resetToken = rows[0];
    if (!resetToken) {
      return NextResponse.json({ error: "Reset link is invalid, expired, or already used." }, { status: 400 });
    }
    if (
      (resetToken.role !== Role.TEACHER &&
        resetToken.role !== Role.STUDENT &&
        resetToken.role !== Role.DEPARTMENT_HEAD) ||
      resetToken.status !== "ACTIVE"
    ) {
      return NextResponse.json({ error: "Reset link is invalid, expired, or already used." }, { status: 400 });
    }

    const nextPasswordHash = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "User"
        SET "passwordHash" = ${nextPasswordHash}, "updatedAt" = NOW()
        WHERE "id" = ${resetToken.userId}
      `;
      await tx.$executeRaw`
        UPDATE "PasswordResetToken"
        SET "usedAt" = NOW()
        WHERE "userId" = ${resetToken.userId} AND "usedAt" IS NULL
      `;
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reset password.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
