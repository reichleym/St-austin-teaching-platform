import { AdminActionType, Prisma, SignupMode } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, requireSuperAdminUser } from "@/lib/permissions";
import { getSystemSettings, type GradeScaleBand, type LatePenaltyRule } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

function toNullableJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function parseDate(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET() {
  try {
    await requireSuperAdminUser();
    const settings = await getSystemSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const superAdmin = await requireSuperAdminUser();
    const body = (await request.json()) as {
      studentSelfSignupEnabled?: boolean;
      studentSignupCutoffDate?: string | null;
      signupMode?: SignupMode;
      gradeScale?: GradeScaleBand[] | null;
      lateSubmissionPenaltyRules?: LatePenaltyRule[] | null;
    };

    if (body.signupMode && body.signupMode !== SignupMode.INVITE_ONLY && body.signupMode !== SignupMode.OPEN_WITH_CUTOFF) {
      return NextResponse.json({ error: "Invalid signup mode." }, { status: 400 });
    }

    const parsedCutoff = body.studentSignupCutoffDate !== undefined ? parseDate(body.studentSignupCutoffDate) : undefined;
    if (body.studentSignupCutoffDate !== undefined && parsedCutoff === undefined) {
      return NextResponse.json({ error: "Invalid `studentSignupCutoffDate`." }, { status: 400 });
    }

    if (body.signupMode === SignupMode.OPEN_WITH_CUTOFF && parsedCutoff === undefined && body.studentSignupCutoffDate === undefined) {
      const existing = await getSystemSettings();
      if (!existing.studentSignupCutoffDate) {
        return NextResponse.json({ error: "Cutoff date is required for OPEN_WITH_CUTOFF mode." }, { status: 400 });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const settings = await tx.systemSettings.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          studentSelfSignupEnabled: body.studentSelfSignupEnabled ?? false,
          studentSignupCutoffDate: parsedCutoff ?? null,
          signupMode: body.signupMode ?? SignupMode.INVITE_ONLY,
          gradeScale: toNullableJson(body.gradeScale ?? null),
          lateSubmissionPenaltyRules: toNullableJson(body.lateSubmissionPenaltyRules ?? null),
          updatedById: superAdmin.id,
        },
        update: {
          studentSelfSignupEnabled: body.studentSelfSignupEnabled,
          studentSignupCutoffDate: parsedCutoff,
          signupMode: body.signupMode,
          gradeScale: body.gradeScale === undefined ? undefined : toNullableJson(body.gradeScale),
          lateSubmissionPenaltyRules:
            body.lateSubmissionPenaltyRules === undefined ? undefined : toNullableJson(body.lateSubmissionPenaltyRules),
          updatedById: superAdmin.id,
        },
      });

      await tx.adminActionLog.create({
        data: {
          action: AdminActionType.UPDATE_SYSTEM_SETTINGS,
          actorId: superAdmin.id,
          entityType: "SystemSettings",
          entityId: String(settings.id),
          metadata: {
            studentSelfSignupEnabled: body.studentSelfSignupEnabled,
            studentSignupCutoffDate: body.studentSignupCutoffDate,
            signupMode: body.signupMode,
            hasGradeScale: body.gradeScale !== undefined,
            hasLatePenaltyRules: body.lateSubmissionPenaltyRules !== undefined,
          },
        },
      });

      return settings;
    });

    return NextResponse.json({ ok: true, settings: updated });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to update settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
