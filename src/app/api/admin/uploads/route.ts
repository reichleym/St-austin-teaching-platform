import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, requireAuthenticatedUser } from "@/lib/permissions";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB for images
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

function sanitizeFileName(input: string) {
  const trimmed = input.trim() || "image";
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (user.role === Role.STUDENT) {
      return NextResponse.json({ error: "Only admins can upload images." }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large. Maximum is 10MB." }, { status: 400 });
    }

    const mime = file.type || "application/octet-stream";
    if (!ALLOWED_IMAGE_TYPES.includes(mime)) {
      return NextResponse.json({ error: "Only image files are supported." }, { status: 400 });
    }

    const ext = path.extname(file.name) || "";
    const safeName = sanitizeFileName(path.basename(file.name, ext));
    const finalName = `${Date.now()}-${randomUUID()}-${safeName}${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", "admin-images");
    await fs.mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const absolutePath = path.join(uploadDir, finalName);
    await fs.writeFile(absolutePath, buffer);

    const publicUrl = `/uploads/admin-images/${finalName}`;

    return NextResponse.json({
      ok: true,
      publicUrl,
      fileName: file.name,
      storageKey: finalName,
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to upload image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
