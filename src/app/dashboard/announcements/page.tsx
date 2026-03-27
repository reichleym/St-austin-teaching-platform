import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/permissions";
import { createServerTranslator } from "@/lib/i18n-server";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { AdminAnnouncementsManager } from "@/components/admin-announcements-manager";
import { dashboardModules } from "@/lib/dashboard-modules";

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
    (error.message.includes("Invalid value for argument `audience`") &&
      error.message.includes("AnnouncementAudience")) ||
    (error.message.includes("Invalid value for argument `in`") &&
      error.message.includes("AnnouncementAudience")) ||
    error.message.toLowerCase().includes("invalid input value for enum \"announcementaudience\"")
  );
}

function isAnnouncementTableMissingError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
    return true;
  }
  if (!(error instanceof Error)) return false;
  return error.message.includes("The table `public.Announcement` does not exist");
}

export default async function AnnouncementsPage() {
  const session = await auth();
  const t = await createServerTranslator();

  if (!session?.user || session.user.status !== "ACTIVE") {
    redirect("/login");
  }

  const roleKey = String(session.user.role ?? "");
  if (!isSuperAdminRole(roleKey)) {
    redirect("/dashboard/announcements-feed");
  }

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
    } else if (isAnnouncementAudienceCompatibilityError(error)) {
      try {
        const legacyAnnouncements = await prisma.announcement.findMany({
          orderBy: { createdAt: "desc" },
          take: 200,
            select: {
              id: true,
              title: true,
              content: true,
              sourceLanguage: true,
              translations: true,
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

  const serializedAnnouncements = adminAnnouncements.map((item) => ({
    ...item,
    expiresAt: item.expiresAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  }));

  const moduleTitle = t(
    "module.announcements",
    undefined,
    dashboardModules.find((item) => item.slug === "announcements")?.title ?? t("announcements")
  );

  return (
    <main className="min-h-screen lg:flex">
      <DashboardSidebar role={roleKey} selectedSlug="announcements" />

      <div className="flex-1 space-y-6 p-6 lg:p-8">
        <DashboardTopbar name={session.user.name} email={session.user.email} role={roleKey} />

        <section className="brand-glass brand-animate overflow-hidden p-6 lg:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="brand-chip">
                <span className="brand-accent-dot" />
                {t("activeModule")}
              </span>
              <h2 className="brand-title brand-title-gradient mt-3 text-4xl font-black">{moduleTitle}</h2>
            </div>
          </div>
        </section>

        <AdminAnnouncementsManager
          initialAnnouncements={serializedAnnouncements}
          detailBaseHref="/dashboard/announcements"
        />
      </div>
    </main>
  );
}
