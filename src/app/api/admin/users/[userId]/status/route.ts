import { AdminActionType, Role, UserStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, requireSuperAdminUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const superAdmin = await requireSuperAdminUser();
    const { userId } = await params;
    const body = (await request.json()) as { enabled?: boolean };

    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "`enabled` boolean is required." }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (target.role === Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Super Admin account cannot be modified here." }, { status: 400 });
    }

    const nextStatus = body.enabled ? UserStatus.ACTIVE : UserStatus.DISABLED;
    if (target.status === nextStatus) {
      return NextResponse.json({ ok: true, status: target.status });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { status: nextStatus },
        select: { id: true, status: true },
      });

      await tx.adminActionLog.create({
        data: {
          action: body.enabled ? AdminActionType.ENABLE_USER : AdminActionType.DISABLE_USER,
          actorId: superAdmin.id,
          targetUserId: user.id,
          entityType: "User",
          entityId: user.id,
          metadata: { previousStatus: target.status, nextStatus },
        },
      });

      return user;
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to update user status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
