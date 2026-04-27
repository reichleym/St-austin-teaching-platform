"use client";

import { upload } from "@vercel/blob/client";

export type AdminImageUploadResult = { publicUrl: string; storageKey: string };

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

function sanitizeFileName(input: string) {
  const trimmed = input.trim() || "image";
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function inferExtension(mimeType: string) {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/svg+xml":
      return ".svg";
    default:
      return "";
  }
}

function getFileExtension(fileName: string) {
  const trimmed = fileName.trim();
  const idx = trimmed.lastIndexOf(".");
  if (idx <= 0 || idx === trimmed.length - 1) return "";
  return trimmed.slice(idx).toLowerCase();
}

export async function uploadAdminImage(file: File): Promise<AdminImageUploadResult> {
  const mime = file.type || "";
  const ext = getFileExtension(file.name) || (mime ? inferExtension(mime) : "");

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File too large. Maximum is 10MB.");
  }

  if (mime && !ALLOWED_IMAGE_TYPES.includes(mime)) {
    throw new Error("Only image files are supported.");
  }

  if (!mime && !ext) {
    throw new Error("Please select an image file.");
  }

  const base = file.name.replace(/\.[^/.]+$/, "");
  const safeBase = sanitizeFileName(base);
  const finalName = `${Date.now()}-${crypto.randomUUID()}-${safeBase}${ext || ""}`;

  const blob = await upload(`admin-images/${finalName}`, file, {
    access: "public",
    contentType: mime || undefined,
    handleUploadUrl: "/api/admin/uploads",
  });

  return { publicUrl: blob.url, storageKey: finalName };
}

