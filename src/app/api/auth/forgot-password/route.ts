import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mailer";

type Body = {
  email?: string;
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

function getBaseUrl(request: NextRequest) {
  const envBase = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envBase) return envBase.replace(/\/$/, "");
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  try {
    await ensurePasswordResetSchema();
    const body = (await request.json()) as Body;
    const email = body.email?.toLowerCase().trim() ?? "";
    if (!email) {
      return NextResponse.json({ ok: true, message: "If this account exists, a reset link has been sent." });
    }

    const users = await prisma.$queryRaw<
      Array<{ id: string; email: string; name: string | null; role: string; status: string }>
    >`
      SELECT "id","email","name","role"::text AS "role","status"::text AS "status"
      FROM "User"
      WHERE "email" = ${email}
      LIMIT 1
    `;
    const user = users[0];
    const allowedRole =
      user?.role === Role.TEACHER || user?.role === Role.STUDENT || user?.role === Role.DEPARTMENT_HEAD;
    const active = user?.status === "ACTIVE";

    if (!user || !allowedRole || !active) {
      return NextResponse.json({ ok: true, message: "If this account exists, a reset link has been sent." });
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
    const resetId = `prt_${randomBytes(10).toString("hex")}`;

    await prisma.$executeRaw`
      INSERT INTO "PasswordResetToken" ("id","userId","tokenHash","expiresAt","usedAt","createdAt")
      VALUES (${resetId},${user.id},${tokenHash},(NOW() + INTERVAL '30 minutes'),${null},NOW())
    `;

    const baseUrl = getBaseUrl(request);
    const resetUrl = `${baseUrl}/reset-password?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(token)}`;

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      resetExpires: expiresAt,
    });

    return NextResponse.json({
      ok: true,
      message: "If this account exists, a reset link has been sent.",
      resetUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
