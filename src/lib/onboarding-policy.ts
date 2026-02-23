export const TEACHER_ONBOARDING_MODE = "INVITE_ONLY" as const;
export const STUDENT_ONBOARDING_MODE = "INVITE_OR_SELF_SIGNUP" as const;

const studentSelfSignupCutoffRaw = process.env.NEXT_PUBLIC_STUDENT_SELF_SIGNUP_CUTOFF_DATE ?? "";

export function getStudentSelfSignupCutoffDate() {
  if (!studentSelfSignupCutoffRaw) {
    return null;
  }

  const parsed = new Date(`${studentSelfSignupCutoffRaw}T23:59:59.999Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isStudentSelfSignupAllowed(at = new Date()) {
  const cutoff = getStudentSelfSignupCutoffDate();
  if (!cutoff) {
    return true;
  }

  return at <= cutoff;
}

export function getStudentSelfSignupCutoffLabel() {
  return studentSelfSignupCutoffRaw || "not configured";
}
