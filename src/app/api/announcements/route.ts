import { NextResponse } from "next/server";
import { requireAuthenticatedUser, PermissionError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAuthenticatedUser();
    const now = new Date();
    const announcements = await prisma.announcement.findMany({
      where: {
        isGlobal: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
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
