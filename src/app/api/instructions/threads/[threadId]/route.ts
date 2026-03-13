// src/app/api/instructions/threads/[threadId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PermissionError, requireAuthenticatedUser } from "@/lib/permissions";

type FlatMessage = {
  id: string;
  threadId: string;
  parentId: string | null;
  authorId: string;
  body: string;
  isTeacherReply: boolean;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string | null; image: string | null; role: string };
};

type MessageNode = FlatMessage & { replies: MessageNode[] };

function buildTree(flat: FlatMessage[]): MessageNode[] {
  const map = new Map<string, MessageNode>();
  flat.forEach((m) => map.set(m.id, { ...m, replies: [] }));
  const roots: MessageNode[] = [];
  flat.forEach((m) => {
    if (m.parentId && map.has(m.parentId)) {
      map.get(m.parentId)!.replies.push(map.get(m.id)!);
    } else if (!m.parentId) {
      roots.push(map.get(m.id)!);
    }
  });
  return roots;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const user = await requireAuthenticatedUser();
    const { threadId } = await params;
    const thread = await prisma.instructionThread.findUniqueOrThrow({
      where: { id: threadId },
      include: {
        student: { select: { id: true, name: true, image: true, role: true } },
        course: { select: { id: true, title: true, code: true, teacherId: true } },
        module: { select: { id: true, title: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, name: true, image: true, role: true } },
          },
        },
      },
    });

    if (
      user.role === Role.STUDENT &&
      thread.isPrivate &&
      thread.studentId !== user.id
    ) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    return NextResponse.json({
      thread: {
        ...thread,
        messages: buildTree(thread.messages as FlatMessage[]),
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load thread." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const user = await requireAuthenticatedUser();
    const { threadId } = await params;

    const staffRoles: string[] = ["TEACHER", "DEPARTMENT_HEAD", "SUPER_ADMIN"];
    if (!staffRoles.includes(String(user.role))) {
      return NextResponse.json({ error: "Only teachers can manage threads." }, { status: 403 });
    }

    const { action } = (await request.json()) as { action: "close" | "togglePin" };

    const thread = await prisma.instructionThread.findUniqueOrThrow({
      where: { id: threadId },
      select: { isPinned: true, status: true },
    });

    const data =
      action === "close"
        ? { status: "CLOSED" as const }
        : action === "togglePin"
        ? { isPinned: !thread.isPinned }
        : null;

    if (!data) {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const updated = await prisma.instructionThread.update({
      where: { id: threadId },
      data,
      select: { id: true, status: true, isPinned: true },
    });

    return NextResponse.json({ ok: true, thread: updated });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update thread." },
      { status: 500 }
    );
  }
}
