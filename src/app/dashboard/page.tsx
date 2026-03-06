import { redirect } from "next/navigation";
import Link from "next/link";
import { Prisma, Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { DashboardRole, dashboardModules } from "@/lib/dashboard-modules";
import { RoleOverview } from "@/components/role-overview";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/permissions";
import { AdminUserManagementTable } from "@/components/admin-user-management-table";
import { AdminAnnouncementsManager } from "@/components/admin-announcements-manager";
import { AnnouncementsFeed } from "@/components/announcements-feed";
import { CoursesModule } from "@/components/courses-module";
import { AssignmentsModule } from "@/components/assignments-module";
import { EngagementModule } from "@/components/engagement-module";
import { AdminProfileSettings } from "@/components/admin-profile-settings";
import { AcademicPoliciesSettings } from "@/components/academic-policies-settings";
import { DepartmentHeadOversightModule } from "@/components/department-head-oversight-module";
import { TeacherMessagesModule } from "@/components/teacher-messages-module";

type Props = {
  searchParams: Promise<{ module?: string }>;
};

type AnnouncementAudienceValue = "BOTH" | "TEACHER_ONLY" | "STUDENT_ONLY";
type FocusPriority = "High" | "Medium" | "Low";
type FocusItem = {
  title: string;
  detail: string;
  priority: FocusPriority;
};
type AppRole = "SUPER_ADMIN" | "ADMIN" | "DEPARTMENT_HEAD" | "TEACHER" | "STUDENT";

function isAnnouncementAudienceCompatibilityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown field `audience`") ||
    error.message.includes("Unknown argument `audience`") ||
    (error.message.includes("Invalid value for argument `audience`") && error.message.includes("AnnouncementAudience")) || (error.message.includes("Invalid value for argument `in`") && error.message.includes("AnnouncementAudience"))
  );
}

function isAnnouncementTableMissingError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
    return true;
  }
  if (!(error instanceof Error)) return false;
  return error.message.includes("The table `public.Announcement` does not exist");
}

function isUserCountryStateCompatibilityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown field `phone`") ||
    error.message.includes("Unknown field `guardianName`") ||
    error.message.includes("Unknown field `guardianPhone`") ||
    error.message.includes("Unknown field `country`") ||
    error.message.includes("Unknown field `state`") ||
    error.message.includes("Unknown argument `phone`") ||
    error.message.includes("Unknown argument `guardianName`") ||
    error.message.includes("Unknown argument `guardianPhone`") ||
    error.message.includes("Unknown argument `country`") ||
    error.message.includes("Unknown argument `state`")
  );
}

export default async function DashboardPage({ searchParams }: Props) {
  const session = await auth();

  if (!session?.user || session.user.status !== "ACTIVE") {
    redirect("/login");
  }

  const roleKey = String(session.user.role ?? "");
  const appRole: AppRole =
    roleKey === "ADMIN"
      ? "ADMIN"
      : roleKey === "SUPER_ADMIN"
        ? "SUPER_ADMIN"
        : roleKey === "DEPARTMENT_HEAD"
          ? "DEPARTMENT_HEAD"
          : roleKey === "TEACHER"
            ? "TEACHER"
            : "STUDENT";
  const moduleRoleKey: DashboardRole =
    roleKey === "ADMIN" || roleKey === "SUPER_ADMIN"
      ? "SUPER_ADMIN"
      : roleKey === "DEPARTMENT_HEAD"
        ? "DEPARTMENT_HEAD"
        : roleKey === "TEACHER"
          ? "TEACHER"
          : roleKey === "STUDENT"
            ? "STUDENT"
            : "STUDENT";
  const roleLabel =
    roleKey === "SUPER_ADMIN" || roleKey === "ADMIN"
      ? "SUPER ADMIN"
      : roleKey === "DEPARTMENT_HEAD"
        ? "DEPARTMENT HEAD"
        : roleKey;
  const params = await searchParams;
  const availableModules = dashboardModules.filter((item) => item.roles.includes(moduleRoleKey));
  const selected =
    availableModules.find((item) => item.slug === params.module) ?? availableModules[0] ?? dashboardModules[0];
  const isSuperAdmin = isSuperAdminRole(roleKey);
  const announcementModuleSlug = isSuperAdmin ? "announcements" : "announcements-feed";
  const roleAnnouncementAudience: AnnouncementAudienceValue[] =
    roleKey === "TEACHER" ? ["BOTH", "TEACHER_ONLY"] : roleKey === "STUDENT" ? ["BOTH", "STUDENT_ONLY"] : ["BOTH"];

  let announcementCount = 0;
  try {
    if (isSuperAdmin) {
      announcementCount = await prisma.announcement.count();
    } else {
      announcementCount = await prisma.announcement.count({
        where: {
          isGlobal: true,
          audience: { in: roleAnnouncementAudience },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
    }
  } catch (error) {
    if (isAnnouncementTableMissingError(error)) {
      announcementCount = 0;
    } else if (isAnnouncementAudienceCompatibilityError(error)) {
      try {
        if (isSuperAdmin) {
          announcementCount = await prisma.announcement.count();
        } else {
          announcementCount = await prisma.announcement.count({
            where: {
              isGlobal: true,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
          });
        }
      } catch (legacyError) {
        if (isAnnouncementTableMissingError(legacyError)) {
          announcementCount = 0;
        } else {
          throw legacyError;
        }
      }
    } else {
      throw error;
    }
  }

  let teacherList: Array<{
    id: string;
    name: string | null;
    email: string;
    status: "ACTIVE" | "DISABLED";
    phone: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
    country: string | null;
    state: string | null;
    role: string;
    createdAt: Date;
  }> = [];

  if (selected.slug === "view-teachers" && isSuperAdmin) {
    try {
      teacherList = await prisma.user.findMany({
        where: { role: Role.TEACHER },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          phone: true,
          guardianName: true,
          guardianPhone: true,
          country: true,
          state: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      if (!isUserCountryStateCompatibilityError(error)) throw error;
      try {
        const rawTeachers = await prisma.$queryRaw<
          Array<{
            id: string;
            name: string | null;
            email: string;
            status: "ACTIVE" | "DISABLED";
            role: string;
            phone: string | null;
            guardianName: string | null;
            guardianPhone: string | null;
            country: string | null;
            state: string | null;
            createdAt: Date;
          }>
        >`SELECT "id","name","email","status"::text AS "status","role"::text AS "role","phone","guardianName","guardianPhone","country","state","createdAt" FROM "User" WHERE "role" = 'TEACHER' ORDER BY "createdAt" DESC`;
        teacherList = rawTeachers;
      } catch {
        const fallbackTeachers = await prisma.user.findMany({
          where: { role: Role.TEACHER },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            role: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        });
        teacherList = fallbackTeachers.map((item) => ({
          ...item,
          phone: null,
          guardianName: null,
          guardianPhone: null,
          country: null,
          state: null,
        }));
      }
    }
  }

  const serializedTeacherList =
    selected.slug === "view-teachers"
      ? teacherList.map((teacher) => ({
          ...teacher,
          createdAt: teacher.createdAt.toISOString(),
        }))
      : [];

  let studentList: Array<{
    id: string;
    name: string | null;
    email: string;
    status: "ACTIVE" | "DISABLED";
    phone: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
    country: string | null;
    state: string | null;
    role: string;
    createdAt: Date;
  }> = [];

  if (selected.slug === "view-students" && isSuperAdmin) {
    try {
      studentList = await prisma.user.findMany({
        where: { role: Role.STUDENT },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          phone: true,
          guardianName: true,
          guardianPhone: true,
          country: true,
          state: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      if (!isUserCountryStateCompatibilityError(error)) throw error;
      try {
        const rawStudents = await prisma.$queryRaw<
          Array<{
            id: string;
            name: string | null;
            email: string;
            status: "ACTIVE" | "DISABLED";
            role: string;
            phone: string | null;
            guardianName: string | null;
            guardianPhone: string | null;
            country: string | null;
            state: string | null;
            createdAt: Date;
          }>
        >`SELECT "id","name","email","status"::text AS "status","role"::text AS "role","phone","guardianName","guardianPhone","country","state","createdAt" FROM "User" WHERE "role" = 'STUDENT' ORDER BY "createdAt" DESC`;
        studentList = rawStudents;
      } catch {
        const fallbackStudents = await prisma.user.findMany({
          where: { role: Role.STUDENT },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            role: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        });
        studentList = fallbackStudents.map((item) => ({
          ...item,
          phone: null,
          guardianName: null,
          guardianPhone: null,
          country: null,
          state: null,
        }));
      }
    }
  }

  const serializedStudentList =
    selected.slug === "view-students"
      ? studentList.map((student) => ({
          ...student,
          createdAt: student.createdAt.toISOString(),
        }))
      : [];

  let departmentHeadList: Array<{
    id: string;
    name: string | null;
    email: string;
    status: "ACTIVE" | "DISABLED";
    phone: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
    country: string | null;
    state: string | null;
    role: string;
    createdAt: Date;
  }> = [];

  if (selected.slug === "view-department-heads" && isSuperAdmin) {
    try {
      if (Role.DEPARTMENT_HEAD === undefined) {
        const rawHeads = await prisma.$queryRaw<
          Array<{
            id: string;
            name: string | null;
            email: string;
            status: "ACTIVE" | "DISABLED";
            role: string;
            phone: string | null;
            guardianName: string | null;
            guardianPhone: string | null;
            country: string | null;
            state: string | null;
            createdAt: Date;
          }>
        >`SELECT "id","name","email","status"::text AS "status","role"::text AS "role","phone","guardianName","guardianPhone","country","state","createdAt" FROM "User" WHERE "role" = 'DEPARTMENT_HEAD' ORDER BY "createdAt" DESC`;
        departmentHeadList = rawHeads;
      } else {
        departmentHeadList = await prisma.user.findMany({
          where: { role: Role.DEPARTMENT_HEAD },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            phone: true,
            guardianName: true,
            guardianPhone: true,
            country: true,
            state: true,
            role: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        });
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Value 'DEPARTMENT_HEAD' not found in enum 'Role'")) {
        const rawHeads = await prisma.$queryRaw<
          Array<{
            id: string;
            name: string | null;
            email: string;
            status: "ACTIVE" | "DISABLED";
            role: string;
            phone: string | null;
            guardianName: string | null;
            guardianPhone: string | null;
            country: string | null;
            state: string | null;
            createdAt: Date;
          }>
        >`SELECT "id","name","email","status"::text AS "status","role"::text AS "role","phone","guardianName","guardianPhone","country","state","createdAt" FROM "User" WHERE "role" = 'DEPARTMENT_HEAD' ORDER BY "createdAt" DESC`;
        departmentHeadList = rawHeads;
      } else {
        if (!isUserCountryStateCompatibilityError(error)) throw error;
        try {
          const rawHeads = await prisma.$queryRaw<
            Array<{
              id: string;
              name: string | null;
              email: string;
              status: "ACTIVE" | "DISABLED";
              role: string;
              phone: string | null;
              guardianName: string | null;
              guardianPhone: string | null;
              country: string | null;
              state: string | null;
              createdAt: Date;
            }>
          >`SELECT "id","name","email","status"::text AS "status","role"::text AS "role","phone","guardianName","guardianPhone","country","state","createdAt" FROM "User" WHERE "role" = 'DEPARTMENT_HEAD' ORDER BY "createdAt" DESC`;
          departmentHeadList = rawHeads;
        } catch {
          if (Role.DEPARTMENT_HEAD === undefined) {
            departmentHeadList = [];
          } else {
            const fallbackHeads = await prisma.user.findMany({
              where: { role: Role.DEPARTMENT_HEAD },
              select: {
                id: true,
                name: true,
                email: true,
                status: true,
                role: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
            });
            departmentHeadList = fallbackHeads.map((item) => ({
              ...item,
              phone: null,
              guardianName: null,
              guardianPhone: null,
              country: null,
              state: null,
            }));
          }
        }
      }
    }
  }

  const serializedDepartmentHeadList =
    selected.slug === "view-department-heads"
      ? departmentHeadList
          .filter((head) => head.role === "DEPARTMENT_HEAD")
          .map((head) => ({
            ...head,
            createdAt: head.createdAt.toISOString(),
          }))
      : [];

  let adminAnnouncements: Array<{
    id: string;
    title: string;
    content: string;
    audience: AnnouncementAudienceValue;
    expiresAt: Date | null;
    createdAt: Date;
  }> = [];

  if (selected.slug === "announcements" && isSuperAdmin) {
    try {
      adminAnnouncements = await prisma.announcement.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          title: true,
          content: true,
          audience: true,
          expiresAt: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (isAnnouncementTableMissingError(error)) {
        adminAnnouncements = [];
      } else if (isAnnouncementAudienceCompatibilityError(error)) {
        try {
          const legacyAnnouncements = await prisma.announcement.findMany({
            orderBy: { createdAt: "desc" },
            take: 200,
            select: {
              id: true,
              title: true,
              content: true,
              expiresAt: true,
              createdAt: true,
            },
          });
          adminAnnouncements = legacyAnnouncements.map((item) => ({ ...item, audience: "BOTH" }));
        } catch (legacyError) {
          if (isAnnouncementTableMissingError(legacyError)) {
            adminAnnouncements = [];
          } else {
            throw legacyError;
          }
        }
      } else {
        throw error;
      }
    }
  }

  const serializedAdminAnnouncements =
    selected.slug === "announcements" && isSuperAdmin
      ? adminAnnouncements.map((item) => ({
          ...item,
          expiresAt: item.expiresAt?.toISOString() ?? null,
          createdAt: item.createdAt.toISOString(),
        }))
      : [];

  let learnerAnnouncements: Array<{
    id: string;
    title: string;
    content: string;
    audience: AnnouncementAudienceValue;
    expiresAt: Date | null;
    createdAt: Date;
  }> = [];

  if (selected.slug === "announcements-feed") {
    try {
      learnerAnnouncements = await prisma.announcement.findMany({
        where: {
          isGlobal: true,
          audience: { in: roleAnnouncementAudience },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          title: true,
          content: true,
          audience: true,
          expiresAt: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (isAnnouncementTableMissingError(error)) {
        learnerAnnouncements = [];
      } else if (isAnnouncementAudienceCompatibilityError(error)) {
        try {
          const legacyAnnouncements = await prisma.announcement.findMany({
            where: {
              isGlobal: true,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            orderBy: { createdAt: "desc" },
            take: 200,
            select: {
              id: true,
              title: true,
              content: true,
              expiresAt: true,
              createdAt: true,
            },
          });
          learnerAnnouncements = legacyAnnouncements.map((item) => ({ ...item, audience: "BOTH" }));
        } catch (legacyError) {
          if (isAnnouncementTableMissingError(legacyError)) {
            learnerAnnouncements = [];
          } else {
            throw legacyError;
          }
        }
      } else {
        throw error;
      }
    }
  }

  const serializedLearnerAnnouncements =
    selected.slug === "announcements-feed"
      ? learnerAnnouncements.map((item) => ({
          ...item,
          expiresAt: item.expiresAt?.toISOString() ?? null,
          createdAt: item.createdAt.toISOString(),
        }))
      : [];

  let overviewAnnouncements: Array<{
    id: string;
    title: string;
  }> = [];

  if (selected.slug === "overview") {
    if (isSuperAdmin) {
      try {
        overviewAnnouncements = await prisma.announcement.findMany({
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { id: true, title: true, audience: true },
        });
      } catch (error) {
        if (isAnnouncementTableMissingError(error)) {
          overviewAnnouncements = [];
        } else if (isAnnouncementAudienceCompatibilityError(error)) {
          try {
            overviewAnnouncements = await prisma.announcement.findMany({
              orderBy: { createdAt: "desc" },
              take: 6,
              select: { id: true, title: true },
            });
          } catch (legacyError) {
            if (isAnnouncementTableMissingError(legacyError)) {
              overviewAnnouncements = [];
            } else {
              throw legacyError;
            }
          }
        } else {
          throw error;
        }
      }
    } else {
      try {
        overviewAnnouncements = await prisma.announcement.findMany({
          where: {
            isGlobal: true,
            audience: { in: roleAnnouncementAudience },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { id: true, title: true, audience: true },
        });
      } catch (error) {
        if (isAnnouncementTableMissingError(error)) {
          overviewAnnouncements = [];
        } else if (isAnnouncementAudienceCompatibilityError(error)) {
          try {
            overviewAnnouncements = await prisma.announcement.findMany({
              where: {
                isGlobal: true,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
              orderBy: { createdAt: "desc" },
              take: 6,
              select: { id: true, title: true },
            });
          } catch (legacyError) {
            if (isAnnouncementTableMissingError(legacyError)) {
              overviewAnnouncements = [];
            } else {
              throw legacyError;
            }
          }
        } else {
          throw error;
        }
      }
    }
  }

  let moduleKpiLabel = "Module Status";
  let moduleKpiValue: string | number = 0;
  let moduleKpiHint = "live count";

  const departmentHeadCourseIds =
    roleKey === "DEPARTMENT_HEAD"
      ? await prisma
          .$queryRaw<Array<{ courseId: string }>>`
            SELECT "courseId"
            FROM "DepartmentHeadCourseAssignment"
            WHERE "departmentHeadId" = ${session.user.id}
          `
          .then((rows) => rows.map((row) => row.courseId))
          .catch(() => [])
      : [];

  const enrolledCoursesCount = await prisma.course.count({
    where: isSuperAdmin
      ? {}
      : roleKey === "TEACHER"
        ? { teacherId: session.user.id }
        : roleKey === "DEPARTMENT_HEAD"
          ? { id: { in: departmentHeadCourseIds.length ? departmentHeadCourseIds : ["__none__"] } }
          : { enrollments: { some: { studentId: session.user.id, status: "ACTIVE" } } },
  });
  const availableCoursesCount =
    roleKey === "STUDENT"
      ? await prisma.course.count({ where: { visibility: "PUBLISHED" } })
      : enrolledCoursesCount;
  const assignmentCount = await prisma.assignment.count({
    where:
      roleKey === "SUPER_ADMIN" || roleKey === "ADMIN"
        ? {}
        : roleKey === "TEACHER"
          ? { course: { teacherId: session.user.id } }
          : roleKey === "DEPARTMENT_HEAD"
            ? { courseId: { in: departmentHeadCourseIds.length ? departmentHeadCourseIds : ["__none__"] } }
            : { course: { enrollments: { some: { studentId: session.user.id, status: "ACTIVE" } } } },
  });
  const pendingGradeEditCount = isSuperAdmin
    ? await prisma.gradeEditRequest.count({ where: { status: "PENDING" } })
    : roleKey === "TEACHER"
      ? await prisma.gradeEditRequest.count({ where: { requestedById: session.user.id, status: "PENDING" } })
      : 0;
  const pendingSubmissionCount =
    roleKey === "TEACHER"
      ? await prisma.$queryRaw<Array<{ count: bigint | number }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "AssignmentSubmission" s
          JOIN "Assignment" a ON a."id" = s."assignmentId"
          JOIN "Course" c ON c."id" = a."courseId"
          WHERE c."teacherId" = ${session.user.id}
            AND s."status" IN ('SUBMITTED','GRADED_DRAFT')
        `.then((rows) => Number(rows[0]?.count ?? 0)).catch(() => 0)
      : 0;
  const engagementDiscussionCount = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public."EngagementDiscussion"') IS NOT NULL AS "exists"
    `
    .then(async (rows) => {
      if (!rows[0]?.exists) return 0;
      if (isSuperAdmin) {
        const countRows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "EngagementDiscussion"
        `;
        return Number(countRows[0]?.count ?? 0);
      }
      if (roleKey === "TEACHER") {
        const countRows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "EngagementDiscussion" d
          JOIN "Course" c ON c."id" = d."courseId"
          WHERE c."teacherId" = ${session.user.id}
        `;
        return Number(countRows[0]?.count ?? 0);
      }
      if (roleKey === "DEPARTMENT_HEAD") {
        const countRows = await prisma
          .$queryRaw<Array<{ count: bigint | number }>>`
            SELECT COUNT(*)::bigint AS count
            FROM "EngagementDiscussion" d
            JOIN "DepartmentHeadCourseAssignment" a ON a."courseId" = d."courseId"
            WHERE a."departmentHeadId" = ${session.user.id}
          `
          .catch(() => [{ count: 0 }]);
        return Number(countRows[0]?.count ?? 0);
      }
      const countRows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "EngagementDiscussion" d
        JOIN "Course" c ON c."id" = d."courseId"
        JOIN "Enrollment" e ON e."courseId" = c."id"
        WHERE e."studentId" = ${session.user.id}
          AND e."status" = CAST('ACTIVE' AS "EnrollmentStatus")
          AND c."visibility" = CAST('PUBLISHED' AS "CourseVisibility")
      `;
      return Number(countRows[0]?.count ?? 0);
    })
    .catch(() => 0);

  const messageCount =
    selected.slug === "messages"
      ? await prisma.$queryRaw<Array<{ exists: boolean }>>`
          SELECT to_regclass('public."DepartmentHeadMessage"') IS NOT NULL AS "exists"
        `
          .then(async (rows) => {
            if (!rows[0]?.exists) return 0;
            const countRows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
              SELECT COUNT(*)::bigint AS count
              FROM "DepartmentHeadMessage"
              WHERE "teacherId" = ${session.user.id}
            `;
            return Number(countRows[0]?.count ?? 0);
          })
          .catch(() => 0)
      : 0;
  const pendingEnrollmentRequestCount = isSuperAdmin
    ? await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT to_regclass('public."EnrollmentRequest"') IS NOT NULL AS "exists"
      `
        .then(async (rows) => {
          if (!rows[0]?.exists) return 0;
          const countRows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
            SELECT COUNT(*)::bigint AS count
            FROM "EnrollmentRequest"
            WHERE "status" = 'PENDING'
          `;
          return Number(countRows[0]?.count ?? 0);
        })
        .catch(() => 0)
    : 0;

  const overviewMetrics =
    roleKey === "SUPER_ADMIN" || roleKey === "ADMIN"
      ? [
          { label: "Announcements", value: announcementCount, delta: "available for your role", href: "/dashboard?module=announcements" },
          { label: "Courses", value: enrolledCoursesCount, delta: "institution total", href: "/dashboard?module=courses" },
          { label: "Grade Edit Requests", value: pendingGradeEditCount, delta: "pending review", href: "/dashboard?module=assessment" },
          { label: "Enrollment Requests", value: pendingEnrollmentRequestCount, delta: "pending approval", href: "/dashboard?module=courses" },
        ]
      : roleKey === "DEPARTMENT_HEAD"
        ? [
            { label: "Courses Overseen", value: enrolledCoursesCount, delta: "assigned coverage", href: "/dashboard?module=courses" },
            { label: "Engagement", value: engagementDiscussionCount, delta: "active discussions", href: "/dashboard?module=engagement" },
            { label: "Assignments", value: assignmentCount, delta: "in assigned courses", href: "/dashboard?module=assessment" },
          ]
        : roleKey === "TEACHER"
          ? [
              { label: "Assigned Courses", value: enrolledCoursesCount, delta: "currently assigned", href: "/dashboard?module=courses" },
              { label: "Submissions Pending", value: pendingSubmissionCount, delta: "awaiting grading", href: "/dashboard?module=assessment" },
              { label: "Assignments", value: assignmentCount, delta: "in your courses", href: "/dashboard?module=assessment" },
            ]
          : [
              { label: "Enrolled Courses", value: enrolledCoursesCount, delta: "active enrollments", href: "/dashboard?module=learning" },
              { label: "Assignments", value: assignmentCount, delta: "available to submit", href: "/dashboard?module=assessment" },
              { label: "Announcements", value: announcementCount, delta: "for your role", href: "/dashboard?module=announcements-feed" },
            ];
  const overviewFocus: FocusItem[] =
    roleKey === "SUPER_ADMIN" || roleKey === "ADMIN"
      ? [
          {
            title: `Review ${pendingGradeEditCount} Grade Edit Request${pendingGradeEditCount === 1 ? "" : "s"}`,
            detail: "Published grade changes require admin approval and full audit logging.",
            priority: (pendingGradeEditCount > 0 ? "High" : "Low") as "High" | "Medium" | "Low",
          },
          {
            title: `Resolve ${pendingEnrollmentRequestCount} Enrollment Request${pendingEnrollmentRequestCount === 1 ? "" : "s"}`,
            detail: "Pending course enrollment approvals impact learner access.",
            priority: (pendingEnrollmentRequestCount > 0 ? "High" : "Low") as "High" | "Medium" | "Low",
          },
          {
            title: `${enrolledCoursesCount} Active Course${enrolledCoursesCount === 1 ? "" : "s"} in Governance`,
            detail: "Monitor assignment, discussion, and policy alignment across courses.",
            priority: "Medium" as "High" | "Medium" | "Low",
          },
        ]
      : roleKey === "DEPARTMENT_HEAD"
        ? [
            {
              title: `${enrolledCoursesCount} Course${enrolledCoursesCount === 1 ? "" : "s"} Under Oversight`,
              detail: "Review instructor timelines and weekly module release cadence.",
              priority: enrolledCoursesCount > 0 ? "High" : "Low",
            },
            {
              title: `${engagementDiscussionCount} Discussion${engagementDiscussionCount === 1 ? "" : "s"} Active`,
              detail: "Ensure participation requirements are being met.",
              priority: engagementDiscussionCount > 0 ? "Medium" : "Low",
            },
            {
              title: `${assignmentCount} Assignment${assignmentCount === 1 ? "" : "s"} in Progress`,
              detail: "Confirm grading pace and late policy adherence.",
              priority: "Low",
            },
          ]
        : roleKey === "TEACHER"
          ? [
              {
                title: `${pendingSubmissionCount} Submission${pendingSubmissionCount === 1 ? "" : "s"} Awaiting Grading`,
                detail: "Prioritize grading queue to keep learner feedback turnaround on track.",
                priority: (pendingSubmissionCount > 0 ? "High" : "Low") as "High" | "Medium" | "Low",
              },
              {
                title: `${assignmentCount} Assignment${assignmentCount === 1 ? "" : "s"} in Course Scope`,
                detail: "Review due dates and attempt settings for upcoming assessment windows.",
                priority: "Medium" as "High" | "Medium" | "Low",
              },
              {
                title: `${engagementDiscussionCount} Discussion Topic${engagementDiscussionCount === 1 ? "" : "s"} Active`,
                detail: "Track missing discussion participation and follow up with students.",
                priority: "Medium" as "High" | "Medium" | "Low",
              },
            ]
          : [
              {
                title: `${assignmentCount} Assignment${assignmentCount === 1 ? "" : "s"} Pending`,
                detail: "Focus on due assignments and maintain timely submissions.",
                priority: (assignmentCount > 0 ? "High" : "Low") as "High" | "Medium" | "Low",
              },
              {
                title: `${enrolledCoursesCount} Enrolled Course${enrolledCoursesCount === 1 ? "" : "s"}`,
                detail: "Open modules in your enrolled courses to maintain progress.",
                priority: "Medium" as "High" | "Medium" | "Low",
              },
              {
                title: `${announcementCount} Announcement${announcementCount === 1 ? "" : "s"} Available`,
                detail: "Review updates from faculty and administration.",
                priority: "Low" as "High" | "Medium" | "Low",
              },
            ];

  if (selected.slug === "announcements" || selected.slug === "announcements-feed" || selected.slug === "overview") {
    moduleKpiLabel = "Announcements";
    moduleKpiValue = announcementCount;
    moduleKpiHint = "available for your role";
  } else if (selected.slug === "courses") {
    moduleKpiLabel = roleKey === "STUDENT" ? "Available Courses" : "Courses";
    moduleKpiValue = roleKey === "STUDENT" ? availableCoursesCount : enrolledCoursesCount;
    moduleKpiHint = "in this module";
  } else if (selected.slug === "learning") {
    moduleKpiLabel = "My Learning";
    moduleKpiValue = enrolledCoursesCount;
    moduleKpiHint = "in this module";
  } else if (selected.slug === "assessment") {
    moduleKpiLabel = "Assignments";
    moduleKpiValue = assignmentCount;
    moduleKpiHint = "in this module";
  } else if (selected.slug === "engagement") {
    moduleKpiLabel = "Discussions";
    moduleKpiValue = engagementDiscussionCount;
    moduleKpiHint = "in this module";
  } else if (selected.slug === "view-teachers") {
    moduleKpiLabel = "Teachers";
    moduleKpiValue = teacherList.length;
    moduleKpiHint = "total records";
  } else if (selected.slug === "view-students") {
    moduleKpiLabel = "Students";
    moduleKpiValue = studentList.length;
    moduleKpiHint = "total records";
  } else if (selected.slug === "view-department-heads") {
    moduleKpiLabel = "Department Heads";
    moduleKpiValue = departmentHeadList.length;
    moduleKpiHint = "total records";
  } else if (selected.slug === "oversight") {
    moduleKpiLabel = "Courses";
    moduleKpiValue = enrolledCoursesCount;
    moduleKpiHint = "under oversight";
  } else if (selected.slug === "messages") {
    moduleKpiLabel = "Messages";
    moduleKpiValue = messageCount;
    moduleKpiHint = "in your inbox";
  } else if (selected.slug === "system-settings" || selected.slug === "admin-profile" || selected.slug === "academic-policies") {
    moduleKpiLabel = "Settings";
    moduleKpiValue = "Admin";
    moduleKpiHint = "profile and platform controls";
  }

  const selectedTitle =
    roleKey === "STUDENT" && selected.slug === "courses"
      ? "All Courses"
      : roleKey === "STUDENT" && selected.slug === "learning"
        ? "My Learning"
        : selected.title;

  return (
    <main className="min-h-screen lg:flex">
      <DashboardSidebar role={roleKey} selectedSlug={selected.slug} />

      <div className="flex-1 space-y-6 p-6 lg:p-8">
        <DashboardTopbar name={session.user.name} email={session.user.email} role={roleKey} />

        <section className="brand-glass brand-animate overflow-hidden p-6 lg:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="brand-chip">
                <span className="brand-accent-dot" />
                Active Module
              </span>
              <h2 className="brand-title brand-title-gradient mt-3 text-4xl font-black">{selectedTitle}</h2>
            </div>
            <div className="brand-accent-card min-w-[170px] px-5 py-4 text-right">
              <p className="text-xs uppercase tracking-[0.16em] text-[#3f6fae]">{moduleKpiLabel}</p>
              <p className="mt-2 text-3xl font-bold text-[#916900]">{moduleKpiValue}</p>
              <p className="text-xs text-[#3a689f]">{moduleKpiHint}</p>
            </div>
          </div>
        </section>

        {selected.slug === "overview" ? (
          <section className="grid gap-4">
            <RoleOverview role={roleKey} name={session.user.name} overview={{ metrics: overviewMetrics, focus: overviewFocus }} />
            <section className="brand-card p-5">
              <p className="brand-section-title">Announcements</p>
              <div className="mt-3 space-y-2">
                {overviewAnnouncements.length ? (
                  overviewAnnouncements.map((item) => (
                    <Link
                      key={item.id}
                      href={`/dashboard?module=${announcementModuleSlug}#announcement-${item.id}`}
                      className="block rounded-lg border border-[#cee2fb] bg-white/75 px-3 py-2 text-sm font-semibold text-[#1f508f] transition hover:bg-[#e8f3ff]"
                    >
                      {item.title}
                    </Link>
                  ))
                ) : (
                  <p className="brand-muted text-sm">No announcements available right now.</p>
                )}
              </div>
            </section>
          </section>
        ) : selected.slug === "announcements" && isSuperAdmin ? (
          <AdminAnnouncementsManager initialAnnouncements={serializedAdminAnnouncements} />
        ) : selected.slug === "announcements-feed" ? (
          <AnnouncementsFeed announcements={serializedLearnerAnnouncements} />
        ) : selected.slug === "courses" ? (
          <CoursesModule role={appRole} viewMode="all" />
        ) : selected.slug === "learning" ? (
          <CoursesModule role={appRole} viewMode={roleKey === "STUDENT" ? "enrolled" : "all"} />
        ) : selected.slug === "assessment" ? (
          <AssignmentsModule role={appRole} />
        ) : selected.slug === "engagement" ? (
          <EngagementModule role={appRole} />
        ) : selected.slug === "view-teachers" ? (
          <section className="grid gap-4">
            <article className="brand-card p-5">
              <p className="brand-section-title">Add Teacher</p>
              <Link
                href="/dashboard/admin/invitations?role=TEACHER"
                className="btn-brand-primary mt-2 inline-flex px-4 py-2 text-sm font-semibold no-underline"
              >
                Send Invite
              </Link>
            </article>
            <AdminUserManagementTable
              key="teachers-table"
              title="Teachers"
              emptyText="No teachers found yet."
              users={serializedTeacherList}
            />
          </section>
        ) : selected.slug === "view-students" ? (
          <section className="grid gap-4">
            <article className="brand-card p-5">
              <p className="brand-section-title">Add Student</p>
              <Link
                href="/dashboard/admin/invitations?role=STUDENT"
                className="btn-brand-primary mt-2 inline-flex px-4 py-2 text-sm font-semibold no-underline"
              >
                Send Invite
              </Link>
            </article>
            <AdminUserManagementTable
              key="students-table"
              title="Students"
              emptyText="No students found yet."
              users={serializedStudentList}
            />
          </section>
        ) : selected.slug === "view-department-heads" ? (
          <section className="grid gap-4">
            <article className="brand-card p-5">
              <p className="brand-section-title">Add Department Head</p>
              <Link
                href="/dashboard/admin/invitations?role=DEPARTMENT_HEAD"
                className="btn-brand-primary mt-2 inline-flex px-4 py-2 text-sm font-semibold no-underline"
              >
                Send Invite
              </Link>
            </article>
            <AdminUserManagementTable
              key="department-heads-table"
              title="Department Heads"
              emptyText="No department heads found yet."
              users={serializedDepartmentHeadList}
            />
          </section>
        ) : selected.slug === "oversight" ? (
          <DepartmentHeadOversightModule />
        ) : selected.slug === "messages" ? (
          <TeacherMessagesModule />
        ) : selected.slug === "admin-profile" ? (
          <AdminProfileSettings />
        ) : selected.slug === "academic-policies" ? (
          <AcademicPoliciesSettings />
        ) : selected.slug === "system-settings" ? (
          <section className="grid gap-4">
            <article className="brand-card p-5">
              <p className="brand-section-title">Policies & Settings</p>
              <p className="brand-muted mt-2 text-sm">Use submenu: Admin Profile or Academic Policies.</p>
            </article>
            <div className="grid gap-3 md:grid-cols-2">
              <Link href="/dashboard?module=admin-profile" className="brand-card p-5 no-underline">
                <p className="brand-section-title">Admin Profile</p>
                <p className="brand-muted mt-2 text-sm">Update account details and password.</p>
              </Link>
              <Link href="/dashboard?module=academic-policies" className="brand-card p-5 no-underline">
                <p className="brand-section-title">Academic Policies</p>
                <p className="brand-muted mt-2 text-sm">Configure grade scale and late penalty rules.</p>
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <article className="brand-card p-5">
                <p className="brand-section-title">Workspace</p>
                <p className="mt-2 text-2xl font-bold text-[#0b3e81]">{roleLabel}</p>
                <p className="brand-muted mt-1 text-sm">Your tools are filtered to match your access level.</p>
              </article>
              <article className="brand-card p-5">
                <p className="brand-section-title">System State</p>
                <p className="mt-2 text-2xl font-bold text-[#0b3e81]">Ready</p>
                <p className="brand-muted mt-1 text-sm">Core modules loaded, access policies active.</p>
              </article>
              <article className="brand-card p-5 md:col-span-2 lg:col-span-1">
                <p className="brand-section-title">Quick Tip</p>
                <p className="mt-2 text-lg font-bold text-[#0b3e81]">Use left menu shortcuts</p>
                <p className="brand-muted mt-1 text-sm">Submenus under Admin help you move faster between controls.</p>
              </article>
            </section>

            <section className="brand-card p-8 text-center">
              <p className="text-lg font-semibold text-[#0a3d7f]">Module content is being finalized.</p>
              <p className="brand-muted mt-2 text-sm">
                Navigation and permissions are live. This area is ready for feature rollout next.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
