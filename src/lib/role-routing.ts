type RoleLike = "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT" | undefined;

export function getRoleHomePath(role: RoleLike) {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return "/dashboard/admin";
  if (role === "TEACHER") return "/dashboard/teacher";
  return "/dashboard/student";
}
