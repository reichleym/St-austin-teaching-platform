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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const superAdmin = await requireSuperAdminUser();
    const { id } = await params;
    const body = (await request.json()) as {
      title?: string;
      content?: string;
      expiresAt?: string | null;
    };

    const title = body.title?.trim();
    const content = body.content?.trim();
    const expiresAt = parseExpiresAt(body.expiresAt);
    if (body.expiresAt !== undefined && expiresAt === undefined) {
      return NextResponse.json({ error: "Invalid expiresAt value." }, { status: 400 });
    }

    const announcement = await prisma.$transaction(async (tx) => {
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
          },
        },
      });

      return updated;
    });

    return NextResponse.json({ ok: true, announcement });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
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
