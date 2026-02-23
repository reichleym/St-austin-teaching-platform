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

export async function GET() {
  try {
    await requireSuperAdminUser();
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ announcements });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load announcements.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const superAdmin = await requireSuperAdminUser();
    const body = (await request.json()) as {
      title?: string;
      content?: string;
      expiresAt?: string | null;
    };

    const title = body.title?.trim() ?? "";
    const content = body.content?.trim() ?? "";
    const expiresAt = parseExpiresAt(body.expiresAt);

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required." }, { status: 400 });
    }
    if (body.expiresAt !== undefined && expiresAt === undefined) {
      return NextResponse.json({ error: "Invalid expiresAt value." }, { status: 400 });
    }

    const announcement = await prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({
        data: {
          title,
          content,
          isGlobal: true,
          expiresAt,
          createdById: superAdmin.id,
          updatedById: superAdmin.id,
        },
      });

      await tx.adminActionLog.create({
        data: {
          action: AdminActionType.CREATE_ANNOUNCEMENT,
          actorId: superAdmin.id,
          entityType: "Announcement",
          entityId: created.id,
          metadata: { title: created.title, expiresAt: created.expiresAt },
        },
      });

      return created;
    });

    return NextResponse.json({ ok: true, announcement }, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to create announcement.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
