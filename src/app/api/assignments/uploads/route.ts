import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, requireAuthenticatedUser } from "@/lib/permissions";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function sanitizeFileName(input: string) {
  const trimmed = input.trim() || "file";
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 140);
}

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large. Max 20MB." }, { status: 400 });
    }

    const ext = path.extname(file.name) || "";
    const safe = sanitizeFileName(path.basename(file.name, ext));
    const finalName = `${Date.now()}-${randomUUID()}-${safe}${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", "assignment-submissions");
    await fs.mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    await fs.writeFile(path.join(uploadDir, finalName), Buffer.from(bytes));

    return NextResponse.json({
      ok: true,
      file: {
        url: `/uploads/assignment-submissions/${finalName}`,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to upload assignment file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
