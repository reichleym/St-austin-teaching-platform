import { AdminActionType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, requireSuperAdminUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function parseExpiresAt(input: unknown) {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (typeof input !== "string") return undefined;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

type AnnouncementAudienceValue = "BOTH" | "TEACHER_ONLY" | "STUDENT_ONLY";

function parseAudience(input: unknown) {
  if (input === undefined) return undefined;
  if (input === "BOTH" || input === "TEACHER_ONLY" || input === "STUDENT_ONLY") return input;
  return null;
}

function isAnnouncementAudienceCompatibilityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown field `audience`") ||
    error.message.includes("Unknown argument `audience`") ||
    (error.message.includes("Invalid value for argument `audience`") && error.message.includes("AnnouncementAudience")) || (error.message.includes("Invalid value for argument `in`") && error.message.includes("AnnouncementAudience"))
  );
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const superAdmin = await requireSuperAdminUser();
    const { id } = await params;
    const body = (await request.json()) as {
      title?: string;
      content?: string;
      expiresAt?: string | null;
      audience?: AnnouncementAudienceValue;
    };

    const title = body.title?.trim();
    const content = body.content?.trim();
    const expiresAt = parseExpiresAt(body.expiresAt);
    const audience = parseAudience(body.audience);
    if (body.expiresAt !== undefined && expiresAt === undefined) {
      return NextResponse.json({ error: "Invalid expiresAt value." }, { status: 400 });
    }
    if (audience === null) {
      return NextResponse.json({ error: "Invalid audience value." }, { status: 400 });
    }

    let announcement: Record<string, unknown>;
    try {
      announcement = await prisma.$transaction(async (tx) => {
        const updated = await tx.announcement.update({
          where: { id },
          data: {
            title,
            content,
            expiresAt,
            audience,
            updatedById: superAdmin.id,
          },
        });

        await tx.adminActionLog.create({
          data: {
            action: AdminActionType.UPDATE_ANNOUNCEMENT,
            actorId: superAdmin.id,
            entityType: "Announcement",
            entityId: updated.id,
            metadata: {
              title: updated.title,
              expiresAt: updated.expiresAt,
              audience: updated.audience,
            },
          },
        });

        return updated as unknown as Record<string, unknown>;
      });
    } catch (error) {
      if (!isAnnouncementAudienceCompatibilityError(error)) throw error;
      announcement = await prisma.$transaction(async (tx) => {
        const updated = await tx.announcement.update({
          where: { id },
          data: {
            title,
            content,
            expiresAt,
            updatedById: superAdmin.id,
          },
        });

        await tx.adminActionLog.create({
          data: {
            action: AdminActionType.UPDATE_ANNOUNCEMENT,
            actorId: superAdmin.id,
            entityType: "Announcement",
            entityId: updated.id,
            metadata: {
              title: updated.title,
              expiresAt: updated.expiresAt,
              audience: "BOTH",
            },
          },
        });

        return { ...updated, audience: "BOTH" } as unknown as Record<string, unknown>;
      });
    }

    return NextResponse.json({ ok: true, announcement });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (
      error instanceof Error &&
      ((error.message.includes("Invalid value for argument `audience`") &&
        error.message.includes("AnnouncementAudience")) ||
        (error.message.includes("Invalid value for argument `in`") &&
          error.message.includes("AnnouncementAudience")))
    ) {
      return NextResponse.json(
        {
          error:
            "This database does not yet support the selected audience value. Please run latest Prisma migrations and regenerate client.",
        },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Unable to update announcement.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const superAdmin = await requireSuperAdminUser();
    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      await tx.announcement.delete({ where: { id } });
      await tx.adminActionLog.create({
        data: {
          action: AdminActionType.DELETE_ANNOUNCEMENT,
          actorId: superAdmin.id,
          entityType: "Announcement",
          entityId: id,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to delete announcement.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
