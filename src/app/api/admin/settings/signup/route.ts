import { AdminActionType, SignupMode } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, requireSuperAdminUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  try {
    const superAdmin = await requireSuperAdminUser();
    const body = (await request.json()) as {
      studentSelfSignupEnabled?: boolean;
      studentSignupCutoffDate?: string | null;
      signupMode?: SignupMode;
    };

    const cutoffDate =
      body.studentSignupCutoffDate === undefined
        ? undefined
        : body.studentSignupCutoffDate === null
          ? null
          : new Date(body.studentSignupCutoffDate);

    if (cutoffDate instanceof Date && Number.isNaN(cutoffDate.getTime())) {
      return NextResponse.json({ error: "Invalid cutoff date." }, { status: 400 });
    }

    if (body.signupMode && body.signupMode !== SignupMode.INVITE_ONLY && body.signupMode !== SignupMode.OPEN_WITH_CUTOFF) {
      return NextResponse.json({ error: "Invalid signup mode." }, { status: 400 });
    }

    const settings = await prisma.$transaction(async (tx) => {
      const updated = await tx.systemSettings.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          studentSelfSignupEnabled: body.studentSelfSignupEnabled ?? false,
          studentSignupCutoffDate: cutoffDate ?? null,
          signupMode: body.signupMode ?? SignupMode.INVITE_ONLY,
          updatedById: superAdmin.id,
        },
        update: {
          studentSelfSignupEnabled: body.studentSelfSignupEnabled,
          studentSignupCutoffDate: cutoffDate,
          signupMode: body.signupMode,
          updatedById: superAdmin.id,
        },
      });

      if (body.studentSelfSignupEnabled !== undefined) {
        await tx.adminActionLog.create({
          data: {
            action: AdminActionType.TOGGLE_STUDENT_SELF_SIGNUP,
            actorId: superAdmin.id,
            entityType: "SystemSettings",
            entityId: "1",
            metadata: { studentSelfSignupEnabled: body.studentSelfSignupEnabled },
          },
        });
      }

      if (cutoffDate !== undefined) {
        await tx.adminActionLog.create({
          data: {
            action: AdminActionType.SET_SIGNUP_CUTOFF,
            actorId: superAdmin.id,
            entityType: "SystemSettings",
            entityId: "1",
            metadata: { studentSignupCutoffDate: body.studentSignupCutoffDate },
          },
        });
      }

      return updated;
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to update signup settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
