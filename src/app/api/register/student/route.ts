import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Role, UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { validateCountryState } from "@/lib/csc-locations";
import { sendStudentVerificationEmail } from "@/lib/mailer";
import { isStudentSelfSignupAllowed } from "@/lib/onboarding-policy";
import { prisma } from "@/lib/prisma";
import { isStudentSelfSignupAllowedAt } from "@/lib/settings";

function isUserCountryStateCompatibilityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown argument `phone`") ||
    error.message.includes("Unknown argument `guardianName`") ||
    error.message.includes("Unknown argument `guardianPhone`") ||
    error.message.includes("Unknown argument `department`") ||
    error.message.includes("Unknown argument `country`") ||
    error.message.includes("Unknown argument `state`") ||
    error.message.includes("Unknown argument `studentId`") ||
    error.message.includes("Unknown field `phone`") ||
    error.message.includes("Unknown field `guardianName`") ||
    error.message.includes("Unknown field `guardianPhone`") ||
    error.message.includes("Unknown field `department`") ||
    error.message.includes("Unknown field `country`") ||
    error.message.includes("Unknown field `state`") ||
    error.message.includes("Unknown field `studentId`")
  );
}

function getBaseUrl(request: Request) {
  return process.env.NEXTAUTH_URL || new URL(request.url).origin;
}

export async function POST(request: Request) {
  const allowedBySystemSettings = await isStudentSelfSignupAllowedAt();
  const allowedByLegacyCutoffPolicy = isStudentSelfSignupAllowed();

  if (!allowedBySystemSettings && !allowedByLegacyCutoffPolicy) {
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
    department?: string;
    guardianName?: string;
    guardianPhone?: string;
    country?: string;
    state?: string;
  };

  const email = body.email?.toLowerCase().trim();
  const password = body.password ?? "";
  const firstName = body.firstName?.trim() ?? "";
  const lastName = body.lastName?.trim() ?? "";
  const phone = body.phone?.trim() ?? "";
  const department = body.department?.trim() ?? "";
  const guardianName = body.guardianName?.trim() ?? "";
  const guardianPhone = body.guardianPhone?.trim() ?? "";
  const country = body.country?.trim() ?? "";
  const state = body.state?.trim() ?? "";
  const name = `${firstName} ${lastName}`.trim() || null;

  if (
    !email ||
    !password ||
    !firstName ||
    !lastName ||
    !phone ||
    !department ||
    !guardianName ||
    !guardianPhone ||
    !country ||
    !state
  ) {
    return NextResponse.json(
      {
        error:
          "Email, password, first name, last name, phone, department, guardian name, guardian phone, country, and state are required.",
      },
      { status: 400 }
    );
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const phoneOk = /^\+?\d{7,15}$/.test(phone.replace(/[^\d+]/g, ""));
  const guardianPhoneOk = /^\+?\d{7,15}$/.test(guardianPhone.replace(/[^\d+]/g, ""));
  if (!phoneOk) {
    return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
  }
  if (!guardianPhoneOk) {
    return NextResponse.json({ error: "Invalid guardian phone number." }, { status: 400 });
  }


  if (!(await validateCountryState(country, state))) {
    return NextResponse.json({ error: "Invalid country/state selection." }, { status: 400 });
  }

  const passwordPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  if (!passwordPolicy.test(password)) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character." },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }


  const passwordHash = await bcrypt.hash(password, 10);

  const token = crypto.randomBytes(32).toString("hex");
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const baseUrl = getBaseUrl(request);
  const verifyUrl = `${baseUrl}/register/student/verify?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: Role.STUDENT,
          status: UserStatus.ACTIVE,
          phone,
          guardianName,
          guardianPhone,
          department,
          country,
          state,
        },
        select: { id: true, name: true, email: true },
      });

      await tx.verificationToken.deleteMany({ where: { identifier: email } });
      await tx.verificationToken.create({
        data: { identifier: email, token, expires: verifyExpires },
      });

      return user;
    });

    try {
      await sendStudentVerificationEmail({
        to: created.email,
        name: created.name,
        verifyUrl,
        verifyExpires,
      });
    } catch (mailError) {
      console.error("Unable to send verification email:", mailError);
      const message = mailError instanceof Error ? mailError.message : "Unknown mail error";
      if (process.env.NODE_ENV !== "production") {
        return NextResponse.json({
          ok: true,
          requiresVerification: true,
          id: created.id,
          verifyUrl,
          warning: `Verification email could not be sent: ${message}. Use verifyUrl locally.`,
        });
      }
      return NextResponse.json({ error: "Unable to send verification email." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, requiresVerification: true, id: created.id });
  } catch (error) {
    if (!isUserCountryStateCompatibilityError(error)) {
      throw error;
    }

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: Role.STUDENT,
          status: UserStatus.ACTIVE,
        },
        select: { id: true, name: true, email: true },
      });

      try {
        await tx.$executeRaw`UPDATE "User" SET "phone" = ${phone}, "guardianName" = ${guardianName}, "guardianPhone" = ${guardianPhone}, "department" = ${department}, "country" = ${country}, "state" = ${state} WHERE "id" = ${user.id}`;
      } catch {
        // Ignore if DB doesn't have columns yet.
      }

      await tx.verificationToken.deleteMany({ where: { identifier: email } });
      await tx.verificationToken.create({
        data: { identifier: email, token, expires: verifyExpires },
      });

      return user;
    });

    try {
      await sendStudentVerificationEmail({
        to: created.email,
        name: created.name,
        verifyUrl,
        verifyExpires,
      });
    } catch (mailError) {
      console.error("Unable to send verification email:", mailError);
      const message = mailError instanceof Error ? mailError.message : "Unknown mail error";
      if (process.env.NODE_ENV !== "production") {
        return NextResponse.json({
          ok: true,
          requiresVerification: true,
          id: created.id,
          verifyUrl,
          warning: `Verification email could not be sent: ${message}. Use verifyUrl locally.`,
        });
      }
      return NextResponse.json({ error: "Unable to send verification email." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, requiresVerification: true, id: created.id });
  }
}
