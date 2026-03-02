import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

  if (!email || !token) {
    return NextResponse.json({ error: "Missing verification email or token." }, { status: 400 });
  }

  const now = new Date();

  const existing = await prisma.verificationToken.findUnique({
    where: {
      identifier_token: {
        identifier: email,
        token,
      },
    },
  });

  if (!existing || existing.expires <= now) {
    return NextResponse.json({ error: "Invalid or expired verification link." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { email, role: Role.STUDENT },
      data: { emailVerified: now },
    });

    await tx.verificationToken.deleteMany({ where: { identifier: email } });
  });

  return NextResponse.json({ ok: true });
}
