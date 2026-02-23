import { NextResponse } from "next/server";
import { PermissionError, requireSuperAdminUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireSuperAdminUser();

    const courses = await prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        teacher: {
          select: { id: true, name: true, email: true },
        },
        assignments: {
          include: {
            grades: {
              select: { id: true, studentId: true, points: true, publishedAt: true, updatedAt: true },
            },
          },
        },
        discussions: {
          include: {
            participations: {
              select: {
                id: true,
                studentId: true,
                postsCount: true,
                completionRate: true,
                lastPostedAt: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ courses });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load oversight data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
