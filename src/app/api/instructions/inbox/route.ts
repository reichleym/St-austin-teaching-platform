// src/app/api/instructions/inbox/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PermissionError, requireAuthenticatedUser } from "@/lib/permissions";

const STAFF_ROLES = ["TEACHER", "DEPARTMENT_HEAD", "SUPER_ADMIN"];

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();

    if (!STAFF_ROLES.includes(String(user.role))) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const threads = await prisma.instructionThread.findMany({
      where: {
        course: { teacherId: user.id },
        status: { in: ["OPEN", "ANSWERED"] },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        student: { select: { id: true, name: true, image: true } },
        course: { select: { id: true, title: true, code: true } },
        module: { select: { id: true, title: true } },
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({ threads });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load inbox." },
      { status: 500 }
    );
  }
}
