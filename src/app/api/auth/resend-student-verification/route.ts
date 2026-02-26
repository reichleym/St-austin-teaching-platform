import crypto from "crypto";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { sendStudentVerificationEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

type Body = {
  email?: string;
};

function getBaseUrl(request: NextRequest) {
  return process.env.NEXTAUTH_URL || request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Body;
  const email = body.email?.trim().toLowerCase() ?? "";

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, emailVerified: true },
  });

  if (!user || user.role !== Role.STUDENT) {
    return NextResponse.json({ error: "Student account not found." }, { status: 404 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ error: "This account is already verified." }, { status: 409 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const baseUrl = getBaseUrl(request);
  const verifyUrl = `${baseUrl}/register/student/verify?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

  await prisma.$transaction(async (tx) => {
    await tx.verificationToken.deleteMany({ where: { identifier: email } });
    await tx.verificationToken.create({
      data: { identifier: email, token, expires: verifyExpires },
    });
  });

  try {
    await sendStudentVerificationEmail({
      to: user.email,
      name: user.name,
      verifyUrl,
      verifyExpires,
    });
  } catch (mailError) {
    const message = mailError instanceof Error ? mailError.message : "Unknown mail error";
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        ok: true,
        verifyUrl,
        warning: `Verification email could not be sent: ${message}. Use verifyUrl locally.`,
      });
    }
    return NextResponse.json({ error: "Unable to send verification email." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
