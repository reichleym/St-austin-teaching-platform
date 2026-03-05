import { redirect } from "next/navigation";
import Link from "next/link";
import { Prisma, Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { dashboardModules } from "@/lib/dashboard-modules";
import { RoleOverview } from "@/components/role-overview";
import { prisma } from "@/lib/prisma";
import { AdminUserManagementTable } from "@/components/admin-user-management-table";
import { AdminAnnouncementsManager } from "@/components/admin-announcements-manager";
import { AnnouncementsFeed } from "@/components/announcements-feed";
import { CoursesModule } from "@/components/courses-module";
import { AssignmentsModule } from "@/components/assignments-module";
import { EngagementModule } from "@/components/engagement-module";
import { AdminProfileSettings } from "@/components/admin-profile-settings";

type Props = {
  searchParams: Promise<{ module?: string }>;
};

type AnnouncementAudienceValue = "BOTH" | "TEACHER_ONLY" | "STUDENT_ONLY";

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

  const params = await searchParams;
  const availableModules = dashboardModules.filter((item) => item.roles.includes(session.user.role));
  const selected =
    availableModules.find((item) => item.slug === params.module) ?? availableModules[0] ?? dashboardModules[0];
  const isSuperAdmin = session.user.role === Role.SUPER_ADMIN;
  const announcementModuleSlug = isSuperAdmin ? "announcements" : "announcements-feed";
  const roleAnnouncementAudience: AnnouncementAudienceValue[] =
    session.user.role === Role.TEACHER ? ["BOTH", "TEACHER_ONLY"] : session.user.role === Role.STUDENT ? ["BOTH", "STUDENT_ONLY"] : ["BOTH"];

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
    role: "TEACHER" | "STUDENT" | "SUPER_ADMIN";
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
            role: "TEACHER" | "STUDENT" | "SUPER_ADMIN";
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
    role: "TEACHER" | "STUDENT" | "SUPER_ADMIN";
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
            role: "TEACHER" | "STUDENT" | "SUPER_ADMIN";
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

  const enrolledCoursesCount = await prisma.course.count({
    where: isSuperAdmin
      ? {}
      : session.user.role === Role.TEACHER
        ? { teacherId: session.user.id }
        : { enrollments: { some: { studentId: session.user.id, status: "ACTIVE" } } },
  });
  const availableCoursesCount =
    session.user.role === Role.STUDENT
      ? await prisma.course.count({ where: { visibility: "PUBLISHED" } })
      : enrolledCoursesCount;
  const assignmentCount = await prisma.assignment.count({
    where:
      session.user.role === Role.SUPER_ADMIN
        ? {}
        : session.user.role === Role.TEACHER
          ? { course: { teacherId: session.user.id } }
          : { course: { enrollments: { some: { studentId: session.user.id, status: "ACTIVE" } } } },
  });
  const pendingGradeEditCount = isSuperAdmin
    ? await prisma.gradeEditRequest.count({ where: { status: "PENDING" } })
    : session.user.role === Role.TEACHER
      ? await prisma.gradeEditRequest.count({ where: { requestedById: session.user.id, status: "PENDING" } })
      : 0;
  const pendingSubmissionCount =
    session.user.role === Role.TEACHER
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
      if (session.user.role === Role.SUPER_ADMIN) {
        const countRows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "EngagementDiscussion"
        `;
        return Number(countRows[0]?.count ?? 0);
      }
      if (session.user.role === Role.TEACHER) {
        const countRows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "EngagementDiscussion" d
          JOIN "Course" c ON c."id" = d."courseId"
          WHERE c."teacherId" = ${session.user.id}
        `;
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
    session.user.role === Role.SUPER_ADMIN
      ? [
          { label: "Announcements", value: announcementCount, delta: "available for your role", href: "/dashboard?module=announcements" },
          { label: "Courses", value: enrolledCoursesCount, delta: "institution total", href: "/dashboard?module=courses" },
          { label: "Grade Edit Requests", value: pendingGradeEditCount, delta: "pending review", href: "/dashboard?module=assessment" },
          { label: "Enrollment Requests", value: pendingEnrollmentRequestCount, delta: "pending approval", href: "/dashboard?module=courses" },
        ]
      : session.user.role === Role.TEACHER
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

  if (selected.slug === "announcements" || selected.slug === "announcements-feed" || selected.slug === "overview") {
    moduleKpiLabel = "Announcements";
    moduleKpiValue = announcementCount;
    moduleKpiHint = "available for your role";
  } else if (selected.slug === "courses") {
    moduleKpiLabel = session.user.role === Role.STUDENT ? "Available Courses" : "Courses";
    moduleKpiValue = session.user.role === Role.STUDENT ? availableCoursesCount : enrolledCoursesCount;
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
  } else if (selected.slug === "system-settings" || selected.slug === "admin-profile") {
    moduleKpiLabel = "Settings";
    moduleKpiValue = "Admin";
    moduleKpiHint = "profile and platform controls";
  }

  const selectedTitle =
    session.user.role === Role.STUDENT && selected.slug === "courses"
      ? "All Courses"
      : session.user.role === Role.STUDENT && selected.slug === "learning"
        ? "My Learning"
        : selected.title;

  return (
    <main className="min-h-screen lg:flex">
      <DashboardSidebar role={session.user.role} selectedSlug={selected.slug} />

      <div className="flex-1 space-y-6 p-6 lg:p-8">
        <DashboardTopbar name={session.user.name} email={session.user.email} role={session.user.role} />

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
            <RoleOverview role={session.user.role} name={session.user.name} overview={{ metrics: overviewMetrics }} />
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
          <CoursesModule role={session.user.role} viewMode="all" />
        ) : selected.slug === "learning" ? (
          <CoursesModule role={session.user.role} viewMode={session.user.role === Role.STUDENT ? "enrolled" : "all"} />
        ) : selected.slug === "assessment" ? (
          <AssignmentsModule role={session.user.role} />
        ) : selected.slug === "engagement" ? (
          <EngagementModule role={session.user.role} />
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
        ) : selected.slug === "admin-profile" ? (
          <AdminProfileSettings />
        ) : selected.slug === "system-settings" ? (
          <section className="grid gap-4">
            <article className="brand-card p-5">
              <p className="brand-section-title">Policies & Settings</p>
              <p className="brand-muted mt-2 text-sm">Manage admin profile and platform-level policies.</p>
            </article>
            <AdminProfileSettings />
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <article className="brand-card p-5">
                <p className="brand-section-title">Workspace</p>
                <p className="mt-2 text-2xl font-bold text-[#0b3e81]">{session.user.role}</p>
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
