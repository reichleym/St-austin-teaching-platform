import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, requireAuthenticatedUser } from "@/lib/permissions";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ["application/pdf", "image/", "video/", "text/", "application/"];

function sanitizeFileName(input: string) {
  const trimmed = input.trim() || "file";
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (user.role === Role.STUDENT) {
      return NextResponse.json({ error: "Only admin/teacher can upload lesson files." }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large. Maximum is 15MB." }, { status: 400 });
    }

    const mime = file.type || "application/octet-stream";
    if (!ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
      return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
    }

    const ext = path.extname(file.name) || "";
    const safeName = sanitizeFileName(path.basename(file.name, ext));
    const finalName = `${Date.now()}-${randomUUID()}-${safeName}${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", "lesson-files");
    await fs.mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const absolutePath = path.join(uploadDir, finalName);
    await fs.writeFile(absolutePath, buffer);

    const publicUrl = `/uploads/lesson-files/${finalName}`;
    const kind = mime === "application/pdf" ? "PDF" : "FILE";

    return NextResponse.json({
      ok: true,
      attachment: {
        kind,
        label: file.name,
        fileName: file.name,
        mimeType: mime,
        sizeBytes: file.size,
        storageKey: finalName,
        publicUrl,
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to upload file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
