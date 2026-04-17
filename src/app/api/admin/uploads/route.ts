import { randomUUID } from "crypto";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { Role } from "@prisma/client";
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

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN ?? process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      return NextResponse.json(
        { error: "Vercel Blob token missing. Set BLOB_READ_WRITE_TOKEN in the environment." },
        { status: 500 }
      );
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

    const blob = await put(`admin-images/${finalName}`, file, {
      access: "public",
      contentType: mime,
      addRandomSuffix: false,
      token: blobToken,
    });

    return NextResponse.json({
      ok: true,
      publicUrl: blob.url,
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
