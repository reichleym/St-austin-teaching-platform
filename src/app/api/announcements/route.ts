import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser, PermissionError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type AnnouncementAudienceValue = "BOTH" | "TEACHER_ONLY" | "STUDENT_ONLY";

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
    const allowedAudience: AnnouncementAudienceValue[] = role === Role.TEACHER ? ["BOTH", "TEACHER_ONLY"] : role === Role.STUDENT ? ["BOTH", "STUDENT_ONLY"] : ["BOTH"];

    let announcements;
    try {
      announcements = await prisma.announcement.findMany({
        where: {
          isGlobal: true,
          audience: { in: allowedAudience },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      if (!isAnnouncementAudienceCompatibilityError(error)) throw error;
      announcements = await prisma.announcement.findMany({
        where: {
          isGlobal: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { createdAt: "desc" },
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
