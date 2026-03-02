import { NextRequest, NextResponse } from "next/server";
import { sendTestEmail } from "@/lib/mailer";
import { PermissionError, requireSuperAdminUser } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  try {
    const superAdmin = await requireSuperAdminUser();
    const body = (await request.json().catch(() => ({}))) as { to?: string };

    const to =
      typeof body.to === "string" && body.to.trim().length > 0
        ? body.to.trim().toLowerCase()
        : superAdmin.email?.trim().toLowerCase();

    if (!to) {
      return NextResponse.json({ error: "Recipient email is required." }, { status: 400 });
    }

    await sendTestEmail({
      to,
      requestedByEmail: superAdmin.email ?? null,
    });

    return NextResponse.json({
      ok: true,
      message: `SMTP test email sent to ${to}.`,
      to,
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to send test email.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
