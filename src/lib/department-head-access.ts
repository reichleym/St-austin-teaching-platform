import { prisma } from "@/lib/prisma";

async function departmentHeadAssignmentTableExists() {
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public."DepartmentHeadCourseAssignment"') IS NOT NULL AS "exists"
    `;
    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
}

export async function getDepartmentHeadAssignedCourseIds(departmentHeadId: string): Promise<string[]> {
  const exists = await departmentHeadAssignmentTableExists();
  if (!exists) return [];
  try {
    const rows = await prisma.$queryRaw<Array<{ courseId: string }>>`
      SELECT "courseId"
      FROM "DepartmentHeadCourseAssignment"
      WHERE "departmentHeadId" = ${departmentHeadId}
    `;
    return rows.map((row) => row.courseId);
  } catch {
    return [];
  }
}

export async function isDepartmentHeadAssignedToCourse(departmentHeadId: string, courseId: string): Promise<boolean> {
  const exists = await departmentHeadAssignmentTableExists();
  if (!exists) return false;
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS(
        SELECT 1
        FROM "DepartmentHeadCourseAssignment"
        WHERE "courseId" = ${courseId} AND "departmentHeadId" = ${departmentHeadId}
      ) AS "exists"
    `;
    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
}

