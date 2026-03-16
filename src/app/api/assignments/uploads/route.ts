import { randomUUID } from "crypto";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
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
    const blobToken = process.env.staustin_READ_WRITE_TOKEN ?? process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      return NextResponse.json(
        { error: "Vercel Blob token missing. Set staustin_READ_WRITE_TOKEN in the environment." },
        { status: 500 }
      );
    }
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

    const blob = await put(`assignment-submissions/${finalName}`, file, {
      access: "public",
      contentType: file.type || "application/octet-stream",
      addRandomSuffix: false,
      token: blobToken,
    });

    return NextResponse.json({
      ok: true,
      file: {
        url: blob.url,
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
