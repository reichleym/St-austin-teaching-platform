import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { PermissionError, requireSuperAdminUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type UpdateBody = {
  name?: string;
  phone?: string | null;
  department?: string | null;
  country?: string | null;
  state?: string | null;
  currentPassword?: string;
  newPassword?: string;
};

function normalizeNullableText(value: string | null | undefined) {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export async function GET() {
  try {
    const admin = await requireSuperAdminUser();
    const profile = await prisma.user.findUnique({
      where: { id: admin.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        department: true,
        country: true,
        state: true,
        updatedAt: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Admin profile not found." }, { status: 404 });
    }

    return NextResponse.json({
      profile: {
        ...profile,
        updatedAt: profile.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load admin profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireSuperAdminUser();
    const body = (await request.json()) as UpdateBody;

    const nextName = body.name?.trim();
    if (body.name !== undefined && !nextName) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    let passwordUpdateData: { passwordHash?: string } = {};
    if (body.newPassword !== undefined || body.currentPassword !== undefined) {
      const currentPassword = body.currentPassword?.trim() ?? "";
      const newPassword = body.newPassword?.trim() ?? "";

      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { error: "Both currentPassword and newPassword are required to change password." },
          { status: 400 }
        );
      }
      if (newPassword.length < 8) {
        return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
      }

      const user = await prisma.user.findUnique({
        where: { id: admin.id },
        select: { passwordHash: true },
      });
      if (!user) {
        return NextResponse.json({ error: "Admin profile not found." }, { status: 404 });
      }

      const currentValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!currentValid) {
        return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
      }

      passwordUpdateData = { passwordHash: await bcrypt.hash(newPassword, 10) };
    }

    const updated = await prisma.user.update({
      where: { id: admin.id },
      data: {
        name: body.name === undefined ? undefined : nextName,
        phone: body.phone === undefined ? undefined : normalizeNullableText(body.phone),
        department: body.department === undefined ? undefined : normalizeNullableText(body.department),
        country: body.country === undefined ? undefined : normalizeNullableText(body.country),
        state: body.state === undefined ? undefined : normalizeNullableText(body.state),
        ...passwordUpdateData,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        department: true,
        country: true,
        state: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      profile: {
        ...updated,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to update admin profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
