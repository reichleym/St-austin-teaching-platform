import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { PermissionError, requireSuperAdminUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type CheckResult = {
  ok: boolean;
  detail?: string;
};

function getSmtpTransport() {
  const service = (process.env.SMTP_SERVICE ?? "").toLowerCase();
  const isGmail = service === "gmail";
  const host = process.env.SMTP_HOST || (isGmail ? "smtp.gmail.com" : "");
  const port = Number(process.env.SMTP_PORT ?? (isGmail ? "465" : ""));
  const user = process.env.SMTP_USER;
  const pass = (process.env.SMTP_PASS ?? "").replace(/\s+/g, "");
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : isGmail;

  if (!host || !Number.isFinite(port) || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: isGmail ? "gmail" : undefined,
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass },
  });
}

async function checkDatabase(): Promise<CheckResult> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown database error";
    return { ok: false, detail };
  }
}

async function checkSmtp(): Promise<CheckResult> {
  try {
    const transporter = getSmtpTransport();
    if (!transporter) {
      return { ok: false, detail: "SMTP is not configured." };
    }
    await transporter.verify();
    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown SMTP error";
    return { ok: false, detail };
  }
}

export async function GET() {
  try {
    await requireSuperAdminUser();

    const [database, smtp] = await Promise.all([checkDatabase(), checkSmtp()]);
    const ok = database.ok && smtp.ok;

    return NextResponse.json(
      {
        ok,
        checks: {
          database,
          smtp,
        },
        timestamp: new Date().toISOString(),
      },
      { status: ok ? 200 : 503 }
    );
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Health check failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
