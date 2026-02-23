import { Role } from "@prisma/client";

type RoleLike = Role | "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT" | undefined;

export function getRoleHomePath(role: RoleLike) {
  if (role === Role.SUPER_ADMIN || role === "ADMIN") return "/dashboard/admin";
  if (role === Role.TEACHER) return "/dashboard/teacher";
  return "/dashboard/student";
}
