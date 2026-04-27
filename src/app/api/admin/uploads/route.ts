import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { Role } from "@prisma/client";
import { PermissionError, requireAuthenticatedUser } from "@/lib/permissions";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB for images
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (user.role === Role.STUDENT) {
      return NextResponse.json({ error: "Only admins can upload images." }, { status: 403 });
    }

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN ?? process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      return NextResponse.json(
        { error: "Server not responding, please try again." },
        { status: 500 }
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Upload endpoint updated. Please refresh the page and try again." },
        { status: 400 }
      );
    }

    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      request,
      body,
      token: blobToken,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("admin-images/")) {
          throw new Error("Invalid upload path.");
        }
        if (pathname.includes("..") || pathname.includes("\\") || pathname.startsWith("/")) {
          throw new Error("Invalid upload path.");
        }

        return {
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          allowedContentTypes: ALLOWED_IMAGE_TYPES,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to upload image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
