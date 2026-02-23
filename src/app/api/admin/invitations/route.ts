import { AdminActionType, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { generateInviteToken, getInviteExpiry } from "@/lib/invitations";
import { sendInvitationEmail } from "@/lib/mailer";
import { requireSuperAdminUser, PermissionError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type InvitableRole = "TEACHER" | "STUDENT";

function parseInvitableRole(value: unknown): InvitableRole | null {
  if (value === Role.TEACHER) return Role.TEACHER;
  if (value === Role.STUDENT) return Role.STUDENT;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const superAdmin = await requireSuperAdminUser();
    const body = (await request.json()) as {
      email?: string;
      role?: Role;
      firstName?: string;
      lastName?: string;
      phone?: string;
    };

    const email = body.email?.toLowerCase().trim();
    const role = parseInvitableRole(body.role);
    const fullName = `${body.firstName?.trim() ?? ""} ${body.lastName?.trim() ?? ""}`.trim();
    const phone = body.phone?.trim() ?? "";

    if (!email || !role) {
      return NextResponse.json({ error: "Valid email and role (TEACHER/STUDENT) are required." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, status: true },
    });

    if (existing?.role === Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Cannot create invitation for Super Admin." }, { status: 400 });
    }

    const token = generateInviteToken();
    const expiresAt = getInviteExpiry();
    const invitation = await prisma.$transaction(async (tx) => {
      await tx.invitation.deleteMany({
        where: {
          email,
          role,
          acceptedAt: null,
        },
      });

      const created = await tx.invitation.create({
        data: {
          email,
          role,
          token,
          expiresAt,
          createdById: superAdmin.id,
        },
      });

      await tx.adminActionLog.create({
        data: {
          action: role === Role.TEACHER ? AdminActionType.INVITE_TEACHER : AdminActionType.INVITE_STUDENT,
          actorId: superAdmin.id,
          targetUserId: existing?.id,
          entityType: "Invitation",
          entityId: created.id,
          metadata: {
            email,
            role,
            fullName: fullName || null,
            phone: phone || null,
          },
        },
      });

      return created;
    });

    const inviteUrl = `${request.nextUrl.origin}/invite/accept?token=${invitation.token}`;
    let warning: string | undefined;
    try {
      await sendInvitationEmail({
        to: email,
        name: fullName || null,
        role,
        inviteUrl,
        inviteExpires: invitation.expiresAt,
        details: phone ? [{ label: "Phone", value: phone }] : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send invitation email.";
      warning = `Invitation created, but email delivery failed: ${message}`;
    }

    return NextResponse.json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      inviteUrl,
      warning,
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Could not create invitation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await requireSuperAdminUser();
    const invitations = await prisma.invitation.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ invitations });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Could not load invitations.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
