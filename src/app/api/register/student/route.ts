import bcrypt from "bcryptjs";
import { Role, UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStudentSelfSignupAllowedAt } from "@/lib/settings";

export async function POST(request: Request) {
  if (!(await isStudentSelfSignupAllowedAt())) {
    return NextResponse.json(
      { error: "Student self-signup is closed. Please request an invite from Super Admin." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    gradeLevel?: string;
    section?: string;
    guardianName?: string;
    guardianPhone?: string;
  };

  const email = body.email?.toLowerCase().trim();
  const password = body.password ?? "";
  const firstName = body.firstName?.trim() ?? "";
  const lastName = body.lastName?.trim() ?? "";
  const phone = body.phone?.trim() ?? "";
  const gradeLevel = body.gradeLevel?.trim() ?? "";
  const section = body.section?.trim() ?? "";
  const guardianName = body.guardianName?.trim() ?? "";
  const guardianPhone = body.guardianPhone?.trim() ?? "";
  const name = `${firstName} ${lastName}`.trim() || null;

  if (!email || !password || !firstName || !lastName || !phone || !gradeLevel || !section || !guardianName || !guardianPhone) {
    return NextResponse.json(
      {
        error:
          "Email, password, first name, last name, phone, grade level, section, guardian name, and guardian phone are required.",
      },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: Role.STUDENT,
      status: UserStatus.ACTIVE,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true });
}
