import Link from "next/link";
import { Prisma } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/permissions";
import { createServerTranslator, getServerLanguage } from "@/lib/i18n-server";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { AnnouncementDetailActions } from "@/components/announcement-detail-actions";
import { getLanguageLocale } from "@/lib/i18n";
import { getAnnouncementLocalization } from "@/lib/announcement-translations";

type Props = {
  params: Promise<{ announcementId: string }>;
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

const formatDate = (value: Date | null, locale: string) => {
  if (!value) return "-";
  return value.toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export default async function AnnouncementDetailPage({ params }: Props) {
  const session = await auth();
  const t = await createServerTranslator();
  const language = await getServerLanguage();
  const locale = getLanguageLocale(language);

  if (!session?.user || session.user.status !== "ACTIVE") {
    redirect("/login");
  }

  const roleKey = String(session.user.role ?? "");
  if (!isSuperAdminRole(roleKey)) {
    const { announcementId } = await params;
    redirect(`/dashboard/announcements-feed/${announcementId}`);
  }

  const { announcementId } = await params;
  let announcement:
    | {
        id: string;
        title: string;
        content: string;
        sourceLanguage: string;
        translations: unknown;
        audience: AnnouncementAudienceValue;
        expiresAt: Date | null;
        createdAt: Date;
      }
    | null = null;

  try {
    announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
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
      announcement = null;
    } else if (
      isAnnouncementAudienceCompatibilityError(error) ||
      isAnnouncementLocalizationCompatibilityError(error)
    ) {
      const legacy = await prisma.announcement.findUnique({
        where: { id: announcementId },
        select: {
          id: true,
          title: true,
          content: true,
          expiresAt: true,
          createdAt: true,
        },
      });
      announcement = legacy
        ? {
            ...legacy,
            sourceLanguage: "en",
            translations: null,
            audience: "BOTH",
          }
        : null;
    } else {
      throw error;
    }
  }

  if (!announcement) {
    notFound();
  }

  const localizedAnnouncement = getAnnouncementLocalization(announcement, language);

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
              <h2 className="brand-title brand-title-gradient mt-3 text-4xl font-black">
                {t("announcement.detailsTitle")}
              </h2>
            </div>
          </div>
        </section>

        <section className="brand-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="brand-section-title">{localizedAnnouncement.title}</p>
              <p className="mt-1 text-xs text-[#3a689f]">{t(`audience.label.${announcement.audience}`)}</p>
            </div>
            <Link
              href="/dashboard/announcements"
              className="text-xs font-semibold text-[#1f518f] underline"
            >
              {t("action.backToAnnouncements")}
            </Link>
          </div>

          <p className="mt-3 whitespace-pre-wrap text-sm text-[#2f5d96]">{localizedAnnouncement.content}</p>

          <div className="mt-4 grid gap-1 text-xs text-[#3f70ae]">
            <span>{t("posted")}: {formatDate(announcement.createdAt, locale)}</span>
            <span>{t("expires")}: {formatDate(announcement.expiresAt, locale)}</span>
          </div>

          <div className="mt-4">
            <AnnouncementDetailActions
              id={announcement.id}
              title={announcement.title}
              sourceLanguage={announcement.sourceLanguage}
              translations={announcement.translations}
              backHref="/dashboard/announcements"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
