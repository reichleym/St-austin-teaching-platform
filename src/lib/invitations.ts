import crypto from "node:crypto";

export function generateInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function getInviteExpiry(hours = Number(process.env.INVITE_EXPIRY_HOURS ?? 168)) {
  const ttlHours = Number.isFinite(hours) && hours > 0 ? hours : 168;
  return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
}
