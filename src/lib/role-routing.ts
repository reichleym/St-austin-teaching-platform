type RoleLike = "SUPER_ADMIN" | "ADMIN" | "DEPARTMENT_HEAD" | "TEACHER" | "STUDENT" | undefined;

export function getRoleHomePath(role: RoleLike) {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return "/dashboard/admin";
  if (role === "DEPARTMENT_HEAD") return "/dashboard/department-head";
  if (role === "TEACHER") return "/dashboard/teacher";
  return "/dashboard/student";
}
