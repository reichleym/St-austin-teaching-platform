import { Role, UserStatus } from "@prisma/client";
import { auth } from "@/lib/auth";

export class PermissionError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "PermissionError";
    this.status = status;
  }
}

export function isSuperAdminRole(role: Role | string | undefined | null) {
  return role === Role.SUPER_ADMIN || role === "SUPER_ADMIN" || role === "ADMIN";
}

export async function requireAuthenticatedUser() {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    throw new PermissionError("Unauthorized", 401);
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new PermissionError("User account is not active", 403);
  }

  return user;
}

export async function requireSuperAdminUser() {
  const user = await requireAuthenticatedUser();
  if (!isSuperAdminRole(user.role)) {
    throw new PermissionError("Super Admin access required", 403);
  }
  return user;
}
