import bcrypt from "bcryptjs";
import { Role, UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    token?: string;
    password?: string;
    name?: string;
  };

  const token = body.token?.trim();
  const password = body.password ?? "";
  const name = body.name?.trim() || null;

  if (!token || !password) {
    return NextResponse.json({ error: "Invitation token and password are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const invite = await prisma.invitation.findUnique({
    where: { token },
    select: { id: true, email: true, role: true, expiresAt: true, acceptedAt: true },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invitation is invalid." }, { status: 404 });
  }

  if (invite.acceptedAt) {
    return NextResponse.json({ error: "Invitation has already been accepted." }, { status: 409 });
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invitation has expired." }, { status: 410 });
  }

  if (invite.role !== Role.TEACHER && invite.role !== Role.STUDENT) {
    return NextResponse.json({ error: "Invitation is invalid." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const resolvedName = name || null;
  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { id: true, role: true },
  });

  await prisma.$transaction(async (tx) => {
    if (existingUser?.role === Role.SUPER_ADMIN) {
      throw new Error("Cannot apply invitation to Super Admin account.");
    }

    if (existingUser) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          name: resolvedName,
          passwordHash,
          role: invite.role,
          status: UserStatus.ACTIVE,
        },
        select: { id: true },
      });
    } else {
      await tx.user.create({
        data: {
          email: invite.email,
          name: resolvedName,
          passwordHash,
          role: invite.role,
          status: UserStatus.ACTIVE,
        },
        select: { id: true },
      });
    }

    await tx.invitation.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true });
}
