import { Prisma, SignupMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type GradeScaleBand = {
  min: number;
  max: number;
  letter: string;
};

export type LatePenaltyRule = {
  windowHours: number;
  deductionPercent: number;
};

type SettingsUpdateInput = {
  studentSelfSignupEnabled?: boolean;
  studentSignupCutoffDate?: Date | null;
  signupMode?: SignupMode;
  gradeScale?: GradeScaleBand[] | null;
  lateSubmissionPenaltyRules?: LatePenaltyRule[] | null;
  updatedById?: string;
};

function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value == null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

export async function getSystemSettings() {
  return prisma.systemSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}

export async function updateSystemSettings(input: SettingsUpdateInput) {
  const updateData: Prisma.SystemSettingsUpdateInput = {};

  if (input.studentSelfSignupEnabled !== undefined) {
    updateData.studentSelfSignupEnabled = input.studentSelfSignupEnabled;
  }
  if (input.studentSignupCutoffDate !== undefined) {
    updateData.studentSignupCutoffDate = input.studentSignupCutoffDate;
  }
  if (input.signupMode !== undefined) {
    updateData.signupMode = input.signupMode;
  }
  if (input.gradeScale !== undefined) {
    updateData.gradeScale = toJson(input.gradeScale);
  }
  if (input.lateSubmissionPenaltyRules !== undefined) {
    updateData.lateSubmissionPenaltyRules = toJson(input.lateSubmissionPenaltyRules);
  }
  if (input.updatedById !== undefined) {
    updateData.updatedBy = input.updatedById ? { connect: { id: input.updatedById } } : { disconnect: true };
  }

  return prisma.systemSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      studentSelfSignupEnabled: input.studentSelfSignupEnabled ?? false,
      studentSignupCutoffDate: input.studentSignupCutoffDate ?? null,
      signupMode: input.signupMode ?? SignupMode.INVITE_ONLY,
      gradeScale: toJson(input.gradeScale ?? null),
      lateSubmissionPenaltyRules: toJson(input.lateSubmissionPenaltyRules ?? null),
      updatedBy: input.updatedById ? { connect: { id: input.updatedById } } : undefined,
    },
    update: updateData,
  });
}

export async function isStudentSelfSignupAllowedAt(at = new Date()) {
  const settings = await getSystemSettings();

  if (!settings.studentSelfSignupEnabled) {
    return false;
  }

  if (settings.signupMode === SignupMode.INVITE_ONLY) {
    return false;
  }

  if (!settings.studentSignupCutoffDate) {
    return true;
  }

  return at <= settings.studentSignupCutoffDate;
}
