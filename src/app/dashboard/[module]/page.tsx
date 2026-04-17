import { redirect } from "next/navigation";
import Link from "next/link";
import { Prisma, Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { dashboardModules } from "@/lib/dashboard-modules";
import type { DashboardRole } from "@/lib/dashboard-modules";
import { RoleOverview } from "@/components/role-overview";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/permissions";
import { AdminUserManagementTable } from "@/components/admin-user-management-table";
import { AdminAnnouncementsManager } from "@/components/admin-announcements-manager";
import { AnnouncementsFeed } from "@/components/announcements-feed";
import { CoursesModule } from "@/components/courses-module";
import { ProgramsModule } from "@/components/programs-module";
import { AssignmentsModule } from "@/components/assignments-module";
import { EngagementModule } from "@/components/engagement-module";
import { AdminProfileSettings } from "@/components/admin-profile-settings";
import { AcademicPoliciesSettings } from "@/components/academic-policies-settings";
import { CalendarEventsSettings } from "@/components/calendar-events-settings";
import { UniversityCareersSettings } from "@/components/university-careers-settings";
import AboutPageEditor from "@/components/about-page-editor";
import { StudentProgressModule } from "@/components/student-progress-module";
import { getTodayTimelineEntries, normalizeDashboardCalendarEvents } from "@/lib/dashboard-calendar";
import { getAnnouncementLocalizedValue } from "@/lib/announcement-translations";
import { createServerTranslator, getServerLanguage } from "@/lib/i18n-server";

type Props = {
  params: Promise<{ module: string }>;
};

type AnnouncementAudienceValue =
  | "BOTH"
  | "TEACHER_ONLY"
  | "STUDENT_ONLY"
  | "DEPARTMENT_HEAD_ONLY"
  | "TEACHER_DEPARTMENT_HEAD"
  | "STUDENT_DEPARTMENT_HEAD"
  | "ALL";

function isAnnouncementAudienceCompatibilityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown field `audience`") ||
    error.message.includes("Unknown argument `audience`") ||
    (error.message.includes("Invalid value for argument `audience`") && error.message.includes("AnnouncementAudience")) ||
    (error.message.includes("Invalid value for argument `in`") && error.message.includes("AnnouncementAudience")) ||
    error.message.toLowerCase().includes("invalid input value for enum \"announcementaudience\"")
  );
}

function isAnnouncementLocalizationCompatibilityError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
    return true;
  }
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown field `sourceLanguage`") ||
    error.message.includes("Unknown field `translations`") ||
    error.message.includes("Unknown argument `sourceLanguage`") ||
    error.message.includes("Unknown argument `translations`")
  );
}

function isAnnouncementVisibilityCompatibilityError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
    return true;
  }
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown field `isGlobal`") ||
    error.message.includes("Unknown field `expiresAt`") ||
    error.message.includes("Unknown argument `isGlobal`") ||
    error.message.includes("Unknown argument `expiresAt`")
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
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
    return true;
  }
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown field `phone`") ||
    error.message.includes("Unknown field `guardianName`") ||
    error.message.includes("Unknown field `guardianPhone`") ||
    error.message.includes("Unknown field `country`") ||
    error.message.includes("Unknown field `state`") ||
    error.message.includes("Unknown field `studentId`") ||
    error.message.includes("Unknown argument `phone`") ||
    error.message.includes("Unknown argument `guardianName`") ||
    error.message.includes("Unknown argument `guardianPhone`") ||
    error.message.includes("Unknown argument `country`") ||
    error.message.includes("Unknown argument `state`") ||
    error.message.includes("Unknown argument `studentId`")
  );
}

function isOverviewMetricCompatibilityError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2022" || error.code === "P2010";
  }
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("unknown field") ||
    message.includes("unknown argument") ||
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("column")
  );
}

async function safeOverviewMetricCount(getCount: () => Promise<number>) {
  try {
    return await getCount();
  } catch (error) {
    if (isOverviewMetricCompatibilityError(error)) {
      return 0;
    }
    throw error;
  }
}

export default async function DashboardPage({ params }: Props) {
  const session = await auth();
  const t = await createServerTranslator();
  const language = await getServerLanguage();

  if (!session?.user || session.user.status !== "ACTIVE") {
    redirect("/login");
  }

  const routeParams = await params;
  const roleKey = String(session.user.role ?? "");
  const moduleRoleKey = (roleKey === "ADMIN" ? "SUPER_ADMIN" : roleKey) as DashboardRole;
  const roleForModules = (roleKey === "SUPER_ADMIN" ||
  roleKey === "ADMIN" ||
  roleKey === "DEPARTMENT_HEAD" ||
  roleKey === "TEACHER" ||
  roleKey === "STUDENT"
    ? roleKey
    : "STUDENT") as "SUPER_ADMIN" | "ADMIN" | "DEPARTMENT_HEAD" | "TEACHER" | "STUDENT";
  const roleLabel =
    roleKey === "SUPER_ADMIN" || roleKey === "ADMIN"
      ? "SUPER ADMIN"
      : roleKey === "DEPARTMENT_HEAD"
        ? "DEPARTMENT HEAD"
        : roleKey;
  const availableModules = dashboardModules.filter((item) => item.roles.includes(moduleRoleKey));
  const selected =
    availableModules.find((item) => item.slug === routeParams.module) ?? availableModules[0] ?? dashboardModules[0];

  const rootKey = "__root__";
  const modulesByParent = new Map<string, typeof availableModules>();
  for (const item of availableModules) {
    const key = item.parentSlug ?? rootKey;
    const group = modulesByParent.get(key) ?? [];
    group.push(item);
    modulesByParent.set(key, group);
  }

  if (selected?.slug && selected.slug !== routeParams.module) {
    redirect(`/dashboard/${selected.slug}`);
  }
  const selectedChildren = selected?.slug ? modulesByParent.get(selected.slug) ?? [] : [];
  if (selectedChildren.length > 0) {
    const firstChild = selectedChildren[0];
    redirect(firstChild.href ?? `/dashboard/${firstChild.slug}`);
  }
  if (selected?.href) {
    redirect(selected.href);
  }
  const isSuperAdmin = isSuperAdminRole(roleKey);
  const announcementModuleSlug = isSuperAdmin ? "announcements" : "announcements-feed";
  const roleAnnouncementAudience: AnnouncementAudienceValue[] =
    roleKey === "TEACHER"
      ? ["TEACHER_ONLY", "BOTH", "TEACHER_DEPARTMENT_HEAD", "ALL"]
      : roleKey === "STUDENT"
        ? ["STUDENT_ONLY", "BOTH", "STUDENT_DEPARTMENT_HEAD", "ALL"]
        : roleKey === "DEPARTMENT_HEAD"
          ? ["DEPARTMENT_HEAD_ONLY", "TEACHER_DEPARTMENT_HEAD", "STUDENT_DEPARTMENT_HEAD", "ALL"]
          : [
              "BOTH",
              "TEACHER_ONLY",
              "STUDENT_ONLY",
              "DEPARTMENT_HEAD_ONLY",
              "TEACHER_DEPARTMENT_HEAD",
              "STUDENT_DEPARTMENT_HEAD",
              "ALL",
            ];

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
    } else if (isAnnouncementAudienceCompatibilityError(error) || isAnnouncementVisibilityCompatibilityError(error)) {
      try {
        if (isSuperAdmin) {
          announcementCount = await prisma.announcement.count();
        } else {
          const legacyAudience = roleAnnouncementAudience.filter((audience) =>
            ["BOTH", "TEACHER_ONLY", "STUDENT_ONLY"].includes(audience)
          );
          announcementCount = await prisma.announcement.count({
            where: {
              isGlobal: true,
              ...(legacyAudience.length ? { audience: { in: legacyAudience } } : {}),
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
          });
        }
      } catch (legacyError) {
        if (isAnnouncementTableMissingError(legacyError)) {
          announcementCount = 0;
        } else {
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
          } catch (fallbackError) {
            if (isAnnouncementTableMissingError(fallbackError)) {
              announcementCount = 0;
            } else if (isAnnouncementVisibilityCompatibilityError(fallbackError)) {
              announcementCount = await prisma.announcement.count().catch(() => 0);
            } else {
              throw fallbackError;
            }
          }
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
    studentId: string | null;
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
          studentId: true,
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
            studentId: string | null;
            phone: string | null;
            guardianName: string | null;
            guardianPhone: string | null;
            country: string | null;
            state: string | null;
            createdAt: Date;
          }>
        >`SELECT "id","name","email","status"::text AS "status","role"::text AS "role","studentId","phone","guardianName","guardianPhone","country","state","createdAt" FROM "User" WHERE "role" = 'STUDENT' ORDER BY "createdAt" DESC`;
        studentList = rawStudents;
      } catch {
        try {
          const fallbackStudents = await prisma.user.findMany({
            where: { role: Role.STUDENT },
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              role: true,
              studentId: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          });
          studentList = fallbackStudents.map((item) => ({
            ...item,
            studentId: item.studentId ?? null,
            phone: null,
            guardianName: null,
            guardianPhone: null,
            country: null,
            state: null,
          }));
        } catch (fallbackError) {
          if (!isUserCountryStateCompatibilityError(fallbackError)) throw fallbackError;
          const minimalStudents = await prisma.user.findMany({
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
          studentList = minimalStudents.map((item) => ({
            ...item,
            studentId: null,
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
    role: "TEACHER" | "STUDENT" | "SUPER_ADMIN" | "DEPARTMENT_HEAD";
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
            role: "TEACHER" | "STUDENT" | "SUPER_ADMIN" | "DEPARTMENT_HEAD";
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
            role: "TEACHER" | "STUDENT" | "SUPER_ADMIN" | "DEPARTMENT_HEAD";
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
              role: "TEACHER" | "STUDENT" | "SUPER_ADMIN" | "DEPARTMENT_HEAD";
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
    sourceLanguage: string;
    translations: unknown;
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
          sourceLanguage: true,
          translations: true,
          audience: true,
          expiresAt: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (isAnnouncementTableMissingError(error)) {
        adminAnnouncements = [];
      } else if (
        isAnnouncementAudienceCompatibilityError(error) ||
        isAnnouncementLocalizationCompatibilityError(error) ||
        isAnnouncementVisibilityCompatibilityError(error)
      ) {
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
          adminAnnouncements = legacyAnnouncements.map((item) => ({
            ...item,
            sourceLanguage: "en",
            translations: null,
            audience: "BOTH",
          }));
        } catch (legacyError) {
          if (isAnnouncementTableMissingError(legacyError)) {
            adminAnnouncements = [];
          } else if (isAnnouncementVisibilityCompatibilityError(legacyError)) {
            try {
              const minimalAnnouncements = await prisma.announcement.findMany({
                orderBy: { createdAt: "desc" },
                take: 200,
                select: {
                  id: true,
                  title: true,
                  content: true,
                  createdAt: true,
                },
              });
              adminAnnouncements = minimalAnnouncements.map((item) => ({
                ...item,
                sourceLanguage: "en",
                translations: null,
                audience: "BOTH",
                expiresAt: null,
              }));
            } catch (minimalError) {
              if (isAnnouncementTableMissingError(minimalError)) {
                adminAnnouncements = [];
              } else {
                throw minimalError;
              }
            }
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
    sourceLanguage: string;
    translations: unknown;
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
          sourceLanguage: true,
          translations: true,
          audience: true,
          expiresAt: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (isAnnouncementTableMissingError(error)) {
        learnerAnnouncements = [];
      } else if (
        isAnnouncementAudienceCompatibilityError(error) ||
        isAnnouncementLocalizationCompatibilityError(error) ||
        isAnnouncementVisibilityCompatibilityError(error)
      ) {
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
          learnerAnnouncements = legacyAnnouncements.map((item) => ({
            ...item,
            sourceLanguage: "en",
            translations: null,
            audience: "BOTH",
          }));
        } catch (legacyError) {
          if (isAnnouncementTableMissingError(legacyError)) {
            learnerAnnouncements = [];
          } else if (isAnnouncementVisibilityCompatibilityError(legacyError)) {
            try {
              const minimalAnnouncements = await prisma.announcement.findMany({
                orderBy: { createdAt: "desc" },
                take: 200,
                select: {
                  id: true,
                  title: true,
                  content: true,
                  createdAt: true,
                },
              });
              learnerAnnouncements = minimalAnnouncements.map((item) => ({
                ...item,
                sourceLanguage: "en",
                translations: null,
                audience: "BOTH",
                expiresAt: null,
              }));
            } catch (minimalError) {
              if (isAnnouncementTableMissingError(minimalError)) {
                learnerAnnouncements = [];
              } else {
                throw minimalError;
              }
            }
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
    sourceLanguage: string;
    translations: unknown;
  }> = [];

  if (selected.slug === "overview") {
    if (isSuperAdmin) {
      try {
        overviewAnnouncements = await prisma.announcement.findMany({
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { id: true, title: true, sourceLanguage: true, translations: true, audience: true },
        });
      } catch (error) {
        if (isAnnouncementTableMissingError(error)) {
          overviewAnnouncements = [];
        } else if (
          isAnnouncementAudienceCompatibilityError(error) ||
          isAnnouncementLocalizationCompatibilityError(error) ||
          isAnnouncementVisibilityCompatibilityError(error)
        ) {
          try {
            const legacyAnnouncements = await prisma.announcement.findMany({
              orderBy: { createdAt: "desc" },
              take: 6,
              select: { id: true, title: true },
            });
            overviewAnnouncements = legacyAnnouncements.map((item) => ({
              ...item,
              sourceLanguage: "en",
              translations: null,
            }));
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
          select: { id: true, title: true, sourceLanguage: true, translations: true, audience: true },
        });
      } catch (error) {
        if (isAnnouncementTableMissingError(error)) {
          overviewAnnouncements = [];
        } else if (
          isAnnouncementAudienceCompatibilityError(error) ||
          isAnnouncementLocalizationCompatibilityError(error) ||
          isAnnouncementVisibilityCompatibilityError(error)
        ) {
          try {
            const legacyAnnouncements = await prisma.announcement.findMany({
              where: {
                isGlobal: true,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
              orderBy: { createdAt: "desc" },
              take: 6,
              select: { id: true, title: true },
            });
            overviewAnnouncements = legacyAnnouncements.map((item) => ({
              ...item,
              sourceLanguage: "en",
              translations: null,
            }));
          } catch (legacyError) {
            if (isAnnouncementTableMissingError(legacyError)) {
              overviewAnnouncements = [];
            } else if (isAnnouncementVisibilityCompatibilityError(legacyError)) {
              try {
                const minimalAnnouncements = await prisma.announcement.findMany({
                  orderBy: { createdAt: "desc" },
                  take: 6,
                  select: { id: true, title: true },
                });
                overviewAnnouncements = minimalAnnouncements.map((item) => ({
                  ...item,
                  sourceLanguage: "en",
                  translations: null,
                }));
              } catch (minimalError) {
                if (isAnnouncementTableMissingError(minimalError)) {
                  overviewAnnouncements = [];
                } else {
                  throw minimalError;
                }
              }
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

  let overviewTimeline: string[] = [];
  if (selected.slug === "overview") {
    try {
      const settings = await prisma.systemSettings.findUnique({
        where: { id: 1 },
        select: { dashboardCalendarEvents: true },
      });
      const calendarEvents = normalizeDashboardCalendarEvents(settings?.dashboardCalendarEvents);
      overviewTimeline = getTodayTimelineEntries(calendarEvents, roleKey);
    } catch {
      overviewTimeline = [];
    }
  }

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

  const enrolledCoursesCount = await safeOverviewMetricCount(async () =>
    prisma.course.count({
      where: isSuperAdmin
        ? {}
        : roleKey === "TEACHER"
          ? { teacherId: session.user.id }
          : roleKey === "DEPARTMENT_HEAD"
            ? { id: { in: departmentHeadCourseIds.length ? departmentHeadCourseIds : ["__none__"] } }
            : { enrollments: { some: { studentId: session.user.id, status: "ACTIVE" } } },
    })
  );
  const assignmentCount = await safeOverviewMetricCount(async () =>
    prisma.assignment.count({
      where:
        roleKey === "SUPER_ADMIN" || roleKey === "ADMIN"
          ? {}
          : roleKey === "TEACHER"
            ? { course: { teacherId: session.user.id } }
            : roleKey === "DEPARTMENT_HEAD"
              ? { courseId: { in: departmentHeadCourseIds.length ? departmentHeadCourseIds : ["__none__"] } }
              : { course: { enrollments: { some: { studentId: session.user.id, status: "ACTIVE" } } } },
    })
  );
  const pendingGradeEditCount = isSuperAdmin
    ? await safeOverviewMetricCount(() => prisma.gradeEditRequest.count({ where: { status: "PENDING" } }))
    : roleKey === "TEACHER"
      ? await safeOverviewMetricCount(() => prisma.gradeEditRequest.count({ where: { requestedById: session.user.id, status: "PENDING" } }))
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
          { label: t("metric.announcements"), value: announcementCount, delta: t("metric.announcements.delta"), href: "/dashboard/announcements" },
          { label: t("metric.courses"), value: enrolledCoursesCount, delta: t("metric.courses.delta"), href: "/dashboard/courses" },
          { label: t("metric.gradeEdit"), value: pendingGradeEditCount, delta: t("metric.gradeEdit.delta"), href: "/dashboard/assessment" },
          {
            label: t("metric.enrollmentRequests"),
            value: pendingEnrollmentRequestCount,
            delta: t("metric.enrollmentRequests.delta"),
            href: "/dashboard/courses/enrollment-requests",
          },
        ]
      : roleKey === "DEPARTMENT_HEAD"
        ? [
            { label: t("metric.coursesOverseen"), value: enrolledCoursesCount, delta: t("metric.coursesOverseen.delta"), href: "/dashboard/courses" },
            { label: t("metric.engagement"), value: engagementDiscussionCount, delta: t("metric.engagement.delta"), href: "/dashboard/engagement" },
            { label: t("metric.assignments"), value: assignmentCount, delta: t("metric.assignments.deltaDept"), href: "/dashboard/assessment" },
          ]
        : roleKey === "TEACHER"
          ? [
              { label: t("metric.assignedCourses"), value: enrolledCoursesCount, delta: t("metric.assignedCourses.delta"), href: "/dashboard/courses" },
              { label: t("metric.submissionsPending"), value: pendingSubmissionCount, delta: t("metric.submissionsPending.delta"), href: "/dashboard/assessment" },
              { label: t("metric.assignments"), value: assignmentCount, delta: t("metric.assignments.deltaTeacher"), href: "/dashboard/assessment" },
            ]
          : [
              { label: t("metric.enrolledCourses"), value: enrolledCoursesCount, delta: t("metric.enrolledCourses.delta"), href: "/dashboard/learning" },
              { label: t("metric.assignments"), value: assignmentCount, delta: t("metric.assignments.deltaStudent"), href: "/dashboard/assessment" },
              { label: t("metric.announcements"), value: announcementCount, delta: t("metric.announcements.deltaStudent"), href: "/dashboard/announcements-feed" },
            ];
  const overviewFocus =
    roleKey === "SUPER_ADMIN" || roleKey === "ADMIN"
      ? [
          {
            title: t("overview.dynamic.superAdmin.gradeEdit.title", {
              count: pendingGradeEditCount,
              suffix: pendingGradeEditCount === 1 ? "" : "s",
            }),
            detail: t("overview.dynamic.superAdmin.gradeEdit.detail"),
            priority: (pendingGradeEditCount > 0 ? "High" : "Low") as "High" | "Medium" | "Low",
          },
          {
            title: t("overview.dynamic.superAdmin.enrollment.title", {
              count: pendingEnrollmentRequestCount,
              suffix: pendingEnrollmentRequestCount === 1 ? "" : "s",
            }),
            detail: t("overview.dynamic.superAdmin.enrollment.detail"),
            priority: (pendingEnrollmentRequestCount > 0 ? "High" : "Low") as "High" | "Medium" | "Low",
          },
          {
            title: t("overview.dynamic.superAdmin.courses.title", {
              count: enrolledCoursesCount,
              suffix: enrolledCoursesCount === 1 ? "" : "s",
            }),
            detail: t("overview.dynamic.superAdmin.courses.detail"),
            priority: "Medium" as "High" | "Medium" | "Low",
          },
        ]
      : roleKey === "DEPARTMENT_HEAD"
        ? [
            {
              title: t("overview.dynamic.departmentHead.courses.title", {
                count: enrolledCoursesCount,
                suffix: enrolledCoursesCount === 1 ? "" : "s",
              }),
              detail: t("overview.dynamic.departmentHead.courses.detail"),
              priority: (enrolledCoursesCount > 0 ? "High" : "Low") as "High" | "Medium" | "Low",
            },
            {
              title: t("overview.dynamic.departmentHead.discussions.title", {
                count: engagementDiscussionCount,
                suffix: engagementDiscussionCount === 1 ? "" : "s",
              }),
              detail: t("overview.dynamic.departmentHead.discussions.detail"),
              priority: (engagementDiscussionCount > 0 ? "Medium" : "Low") as "High" | "Medium" | "Low",
            },
            {
              title: t("overview.dynamic.departmentHead.assignments.title", {
                count: assignmentCount,
                suffix: assignmentCount === 1 ? "" : "s",
              }),
              detail: t("overview.dynamic.departmentHead.assignments.detail"),
              priority: "Low" as "High" | "Medium" | "Low",
            },
          ]
        : roleKey === "TEACHER"
          ? [
              {
                title: t("overview.dynamic.teacher.submissions.title", {
                  count: pendingSubmissionCount,
                  suffix: pendingSubmissionCount === 1 ? "" : "s",
                }),
                detail: t("overview.dynamic.teacher.submissions.detail"),
                priority: (pendingSubmissionCount > 0 ? "High" : "Low") as "High" | "Medium" | "Low",
              },
              {
                title: t("overview.dynamic.teacher.assignments.title", {
                  count: assignmentCount,
                  suffix: assignmentCount === 1 ? "" : "s",
                }),
                detail: t("overview.dynamic.teacher.assignments.detail"),
                priority: "Medium" as "High" | "Medium" | "Low",
              },
              {
                title: t("overview.dynamic.teacher.discussions.title", {
                  count: engagementDiscussionCount,
                  suffix: engagementDiscussionCount === 1 ? "" : "s",
                }),
                detail: t("overview.dynamic.teacher.discussions.detail"),
                priority: "Medium" as "High" | "Medium" | "Low",
              },
            ]
          : [
              {
                title: t("overview.dynamic.student.assignments.title", {
                  count: assignmentCount,
                  suffix: assignmentCount === 1 ? "" : "s",
                }),
                detail: t("overview.dynamic.student.assignments.detail"),
                priority: (assignmentCount > 0 ? "High" : "Low") as "High" | "Medium" | "Low",
              },
              {
                title: t("overview.dynamic.student.courses.title", {
                  count: enrolledCoursesCount,
                  suffix: enrolledCoursesCount === 1 ? "" : "s",
                }),
                detail: t("overview.dynamic.student.courses.detail"),
                priority: "Medium" as "High" | "Medium" | "Low",
              },
              {
                title: t("overview.dynamic.student.announcements.title", {
                  count: announcementCount,
                  suffix: announcementCount === 1 ? "" : "s",
                }),
                detail: t("overview.dynamic.student.announcements.detail"),
                priority: "Low" as "High" | "Medium" | "Low",
              },
            ];

  const baseTitle =
    roleKey === "STUDENT" && selected.slug === "courses"
      ? "All Courses"
      : roleKey === "STUDENT" && selected.slug === "learning"
        ? "My Learning"
        : selected.title;
  const selectedTitleKey =
    selected.slug === "courses" && roleKey === "STUDENT"
      ? "module.courses.student"
      : selected.slug === "learning" && roleKey === "STUDENT"
        ? "module.learning.student"
        : selected.slug === "instructions" && roleKey === "STUDENT"
          ? "module.instructions.student"
          : selected.slug === "instructions" && (roleKey === "TEACHER" || roleKey === "DEPARTMENT_HEAD")
            ? "module.instructions.teacher"
            : `module.${selected.slug}`;
  const selectedTitle = t(selectedTitleKey, undefined, baseTitle);

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
                {t("activeModule")}
              </span>
              <h2 className="brand-title brand-title-gradient mt-3 text-4xl font-black">{selectedTitle}</h2>
            </div>
            {/* <div className="brand-accent-card min-w-[170px] px-5 py-4 text-right">
              <p className="text-xs uppercase tracking-[0.16em] text-[#3f6fae]">{moduleKpiLabel}</p>
              <p className="mt-2 text-3xl font-bold text-[#916900]">{moduleKpiValue}</p>
              <p className="text-xs text-[#3a689f]">{moduleKpiHint}</p>
            </div> */}
          </div>
        </section>

        {selected.slug === "overview" ? (
          <section className="grid gap-4">
            <RoleOverview
              role={roleKey}
              name={session.user.name}
              overview={{
                metrics: overviewMetrics,
                focus: overviewFocus,
                timeline: overviewTimeline,
              }}
            />
            <section className="brand-card p-5">
              <p className="brand-section-title">{t("announcements")}</p>
              <div className="mt-3 space-y-2">
                {overviewAnnouncements.length ? (
                  overviewAnnouncements.map((item) => (
                    <Link
                      key={item.id}
                      href={`/dashboard/${announcementModuleSlug}#announcement-${item.id}`}
                      className="block rounded-lg border border-[#cee2fb] bg-white/75 px-3 py-2 text-sm font-semibold text-[#1f508f] transition hover:bg-[#e8f3ff]"
                    >
                      {getAnnouncementLocalizedValue(item, language, "title")}
                    </Link>
                  ))
                ) : (
                  <p className="brand-muted text-sm">{t("announcements.noneAvailable")}</p>
                )}
              </div>
            </section>
          </section>
        ) : selected.slug === "announcements" && isSuperAdmin ? (
          <AdminAnnouncementsManager initialAnnouncements={serializedAdminAnnouncements} />
        ) : selected.slug === "announcements-feed" ? (
          <AnnouncementsFeed announcements={serializedLearnerAnnouncements} />
        ) : selected.slug === "courses" ? (
          <CoursesModule role={roleForModules} viewMode="all" showModuleManagement />
        ) : selected.slug === "programs" ? (
          <ProgramsModule role={roleForModules} />
        ) : selected.slug === "learning" ? (
          <CoursesModule
            role={roleForModules}
            viewMode={roleKey === "STUDENT" ? "enrolled" : "all"}
            showModuleManagement={false}
          />
        ) : selected.slug === "progress" ? (
          <StudentProgressModule role={roleForModules} />
        ) : selected.slug === "assessment" ? (
          <AssignmentsModule role={roleForModules} />
        ) : selected.slug === "engagement" ? (
          <EngagementModule role={roleForModules} />
        ) : selected.slug === "about" ? (
          <AboutPageEditor />
        ) : selected.slug === "view-teachers" ? (
          <section className="grid gap-4">
            <article className="brand-card p-5">
              <p className="brand-section-title">{t("adminUsers.addTeacher")}</p>
              <Link
                href="/dashboard/admin/invitations?role=TEACHER"
                className="btn-brand-primary mt-2 inline-flex px-4 py-2 text-sm font-semibold no-underline"
              >
                {t("action.sendInvite")}
              </Link>
            </article>
            <AdminUserManagementTable
              key="teachers-table"
              entityKey="teacher"
              title={t("module.view-teachers")}
              emptyText={t("course.noTeachersMatch", undefined, "No teachers found yet.")}
              users={serializedTeacherList}
            />
          </section>
        ) : selected.slug === "view-students" ? (
          <section className="grid gap-4">
            <article className="brand-card p-5">
              <p className="brand-section-title">{t("adminUsers.addStudent")}</p>
              <Link
                href="/dashboard/admin/invitations?role=STUDENT"
                className="btn-brand-primary mt-2 inline-flex px-4 py-2 text-sm font-semibold no-underline"
              >
                {t("action.sendInvite")}
              </Link>
            </article>
            <AdminUserManagementTable
              key="students-table"
              entityKey="student"
              title={t("module.view-students")}
              emptyText={t("course.noStudents", undefined, "No students found yet.")}
              users={serializedStudentList}
            />
          </section>
        ) : selected.slug === "view-department-heads" ? (
          <section className="grid gap-4">
            <article className="brand-card p-5">
              <p className="brand-section-title">{t("adminUsers.addDepartmentHead")}</p>
              <Link
                href="/dashboard/admin/invitations?role=DEPARTMENT_HEAD"
                className="btn-brand-primary mt-2 inline-flex px-4 py-2 text-sm font-semibold no-underline"
              >
                {t("action.sendInvite")}
              </Link>
            </article>
            <AdminUserManagementTable
              key="department-heads-table"
              entityKey="departmentHead"
              title={t("module.view-department-heads")}
              emptyText={t("course.noDepartmentHeads", undefined, "No department heads found yet.")}
              users={serializedDepartmentHeadList}
            />
          </section>
        ) : selected.slug === "admin-profile" ? (
          <AdminProfileSettings />
        ) : selected.slug === "academic-policies" ? (
          <AcademicPoliciesSettings />
        ) : selected.slug === "calendar-events" ? (
          <CalendarEventsSettings />
        ) : selected.slug === "careers" ? (
          <UniversityCareersSettings />
        ) : selected.slug === "system-settings" ? (
          <section className="grid gap-4">
            <article className="brand-card p-5">
              <p className="brand-section-title">Policies & Settings</p>
              <p className="brand-muted mt-2 text-sm">Use submenu: Admin Profile, Academic Policies, or Calendar Events.</p>
            </article>
            <div className="grid gap-3 md:grid-cols-3">
              <Link href="/dashboard/admin-profile" className="brand-card p-5 no-underline">
                <p className="brand-section-title">Admin Profile</p>
                <p className="brand-muted mt-2 text-sm">Update account details and password.</p>
              </Link>
              <Link href="/dashboard/academic-policies" className="brand-card p-5 no-underline">
                <p className="brand-section-title">Academic Policies</p>
                <p className="brand-muted mt-2 text-sm">Configure grade scale and late penalty rules.</p>
              </Link>
              <Link href="/dashboard/calendar-events" className="brand-card p-5 no-underline">
                <p className="brand-section-title">Calendar Events</p>
                <p className="brand-muted mt-2 text-sm">Plan daily role-based events shown in Overview.</p>
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
