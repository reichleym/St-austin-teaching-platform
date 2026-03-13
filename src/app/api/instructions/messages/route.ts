// src/app/api/instructions/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PermissionError, requireAuthenticatedUser } from "@/lib/permissions";

const STAFF_ROLES = ["TEACHER", "DEPARTMENT_HEAD", "SUPER_ADMIN"];

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();

    const { threadId, parentId = null, body: messageBody } = (await request.json()) as {
      threadId?: string;
      parentId?: string | null;
      body?: string;
    };

    if (!threadId?.trim()) return NextResponse.json({ error: "threadId is required." }, { status: 400 });
    if (!messageBody?.trim()) return NextResponse.json({ error: "body is required." }, { status: 400 });

    const thread = await prisma.instructionThread.findUniqueOrThrow({
      where: { id: threadId },
      select: { status: true, studentId: true },
    });

    if (thread.status === "CLOSED") {
      return NextResponse.json({ error: "This thread is closed." }, { status: 400 });
    }

    if (user.role === Role.STUDENT && thread.studentId !== user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    if (parentId) {
      const parent = await prisma.instructionMessage.findUnique({
        where: { id: parentId },
        select: { threadId: true },
      });
      if (!parent || parent.threadId !== threadId) {
        return NextResponse.json({ error: "Invalid parentId." }, { status: 400 });
      }
    }

    const isStaff = STAFF_ROLES.includes(String(user.role));
    const newStatus =
      isStaff && thread.status === "OPEN"
        ? "ANSWERED"
        : !isStaff && thread.status === "ANSWERED"
        ? "OPEN"
        : thread.status;

    const [message] = await prisma.$transaction([
      prisma.instructionMessage.create({
        data: {
          threadId,
          parentId: parentId || null,
          authorId: user.id,
          body: messageBody.trim(),
          isTeacherReply: isStaff,
        },
        include: {
          author: { select: { id: true, name: true, image: true, role: true } },
        },
      }),
      prisma.instructionThread.update({
        where: { id: threadId },
        data: { status: newStatus, updatedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to post reply." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const messageId = request.nextUrl.searchParams.get("messageId")?.trim();

    if (!messageId) {
      return NextResponse.json({ error: "messageId is required." }, { status: 400 });
    }

    const msg = await prisma.instructionMessage.findUniqueOrThrow({
      where: { id: messageId },
      select: { authorId: true, isDeleted: true },
    });

    if (msg.isDeleted) {
      return NextResponse.json({ error: "Already deleted." }, { status: 400 });
    }

    const isAuthor = msg.authorId === user.id;
    const isAdmin = ["SUPER_ADMIN", "DEPARTMENT_HEAD"].includes(String(user.role));

    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    await prisma.instructionMessage.update({
      where: { id: messageId },
      data: { isDeleted: true, deletedAt: new Date(), body: "[deleted]" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete message." },
      { status: 500 }
    );
  }
}
