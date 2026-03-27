import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser, PermissionError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type AnnouncementAudienceValue =
  | "BOTH"
  | "TEACHER_ONLY"
  | "STUDENT_ONLY"
  | "DEPARTMENT_HEAD_ONLY"
  | "TEACHER_DEPARTMENT_HEAD"
  | "STUDENT_DEPARTMENT_HEAD"
  | "ALL";

function isAnnouncementAudienceCompatibilityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown field `audience`") ||
    error.message.includes("Unknown argument `audience`") ||
    (error.message.includes("Invalid value for argument `audience`") && error.message.includes("AnnouncementAudience")) || (error.message.includes("Invalid value for argument `in`") && error.message.includes("AnnouncementAudience"))
  );
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const role = user.role === "SUPER_ADMIN" ? Role.SUPER_ADMIN : user.role;
    const now = new Date();
    const allowedAudience: AnnouncementAudienceValue[] =
      role === Role.TEACHER
        ? ["TEACHER_ONLY", "BOTH", "TEACHER_DEPARTMENT_HEAD", "ALL"]
        : role === Role.STUDENT
          ? ["STUDENT_ONLY", "BOTH", "STUDENT_DEPARTMENT_HEAD", "ALL"]
          : role === Role.DEPARTMENT_HEAD
            ? ["DEPARTMENT_HEAD_ONLY", "TEACHER_DEPARTMENT_HEAD", "STUDENT_DEPARTMENT_HEAD", "ALL"]
            : [
                "BOTH",
                "TEACHER_ONLY",
                "STUDENT_ONLY",
                "DEPARTMENT_HEAD_ONLY",
                "TEACHER_DEPARTMENT_HEAD",
                "STUDENT_DEPARTMENT_HEAD",
                "ALL",
              ];

    let announcements;
    try {
      announcements = await prisma.announcement.findMany({
        where: {
          isGlobal: true,
          audience: { in: allowedAudience },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          content: true,
          sourceLanguage: true,
          translations: true,
          isGlobal: true,
          audience: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          createdById: true,
          updatedById: true,
        },
      });
    } catch (error) {
      if (!isAnnouncementAudienceCompatibilityError(error)) throw error;
      announcements = await prisma.announcement.findMany({
        where: {
          isGlobal: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          content: true,
          sourceLanguage: true,
          translations: true,
          isGlobal: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          createdById: true,
          updatedById: true,
        },
      });
    }

    return NextResponse.json({ announcements });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load announcements.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
