import { AdminActionType, Prisma, SignupMode } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { normalizeDashboardCalendarEvents, type DashboardCalendarEvent } from "@/lib/dashboard-calendar";
import { normalizeUniversityCareers } from "@/lib/university-careers";
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

async function readUniversityCareersJson() {
  try {
    const rows = await prisma.$queryRaw<Array<{ universityCareers: Prisma.JsonValue | null }>>`
      SELECT "universityCareers"
      FROM "SystemSettings"
      WHERE "id" = 1
      LIMIT 1
    `;
    return rows[0]?.universityCareers ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    await requireSuperAdminUser();
    const settings = await getSystemSettings();
    const universityCareers = await readUniversityCareersJson();
    return NextResponse.json({
      settings: {
        ...settings,
        universityCareers,
      },
    });
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
      dashboardCalendarEvents?: DashboardCalendarEvent[] | null;
      universityCareers?: unknown;
    };

    if (body.signupMode && body.signupMode !== SignupMode.INVITE_ONLY && body.signupMode !== SignupMode.OPEN_WITH_CUTOFF) {
      return NextResponse.json({ error: "Invalid signup mode." }, { status: 400 });
    }

    const parsedCutoff = body.studentSignupCutoffDate !== undefined ? parseDate(body.studentSignupCutoffDate) : undefined;
    if (body.studentSignupCutoffDate !== undefined && parsedCutoff === undefined) {
      return NextResponse.json({ error: "Invalid `studentSignupCutoffDate`." }, { status: 400 });
    }
    if (body.dashboardCalendarEvents !== undefined && body.dashboardCalendarEvents !== null && !Array.isArray(body.dashboardCalendarEvents)) {
      return NextResponse.json({ error: "Invalid `dashboardCalendarEvents` payload." }, { status: 400 });
    }
    const parsedCalendarEvents =
      body.dashboardCalendarEvents === undefined
        ? undefined
        : body.dashboardCalendarEvents === null
          ? null
          : normalizeDashboardCalendarEvents(body.dashboardCalendarEvents);

    const parsedCareers = body.universityCareers === undefined
      ? undefined
      : normalizeUniversityCareers(body.universityCareers);

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
          dashboardCalendarEvents: toNullableJson(parsedCalendarEvents ?? null),
          updatedById: superAdmin.id,
        },
        update: {
          studentSelfSignupEnabled: body.studentSelfSignupEnabled,
          studentSignupCutoffDate: parsedCutoff,
          signupMode: body.signupMode,
          gradeScale: body.gradeScale === undefined ? undefined : toNullableJson(body.gradeScale),
          lateSubmissionPenaltyRules:
            body.lateSubmissionPenaltyRules === undefined ? undefined : toNullableJson(body.lateSubmissionPenaltyRules),
          dashboardCalendarEvents:
            parsedCalendarEvents === undefined ? undefined : toNullableJson(parsedCalendarEvents),
          updatedById: superAdmin.id,
        },
      });

      if (parsedCareers !== undefined) {
        const serializedCareers = parsedCareers === null ? null : JSON.stringify(parsedCareers);
        await tx.$executeRaw`
          ALTER TABLE "SystemSettings"
          ADD COLUMN IF NOT EXISTS "universityCareers" JSONB
        `;
        if (serializedCareers === null) {
          await tx.$executeRaw`
            UPDATE "SystemSettings"
            SET "universityCareers" = NULL
            WHERE "id" = ${settings.id}
          `;
        } else {
          await tx.$executeRaw`
            UPDATE "SystemSettings"
            SET "universityCareers" = ${serializedCareers}::jsonb
            WHERE "id" = ${settings.id}
          `;
        }
      }

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
            hasDashboardCalendarEvents: parsedCalendarEvents !== undefined,
            dashboardCalendarEventCount: parsedCalendarEvents?.length,
            hasUniversityCareers: parsedCareers !== undefined,
            universityCareersCount: parsedCareers?.length,
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
