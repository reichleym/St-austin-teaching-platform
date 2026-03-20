import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/permissions";
import { createServerTranslator } from "@/lib/i18n-server";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { AnnouncementDetailActions } from "@/components/announcement-detail-actions";

type Props = {
  params: Promise<{ announcementId: string }>;
};

const formatDate = (value: Date | null) => {
  if (!value) return "-";
  return value.toLocaleString("en-GB", {
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

  if (!session?.user || session.user.status !== "ACTIVE") {
    redirect("/login");
  }

  const roleKey = String(session.user.role ?? "");
  if (!isSuperAdminRole(roleKey)) {
    const { announcementId } = await params;
    redirect(`/dashboard/announcements-feed/${announcementId}`);
  }

  const { announcementId } = await params;
  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: {
      id: true,
      title: true,
      content: true,
      audience: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  if (!announcement) {
    notFound();
  }

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
                Active Module
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
              <p className="brand-section-title">{announcement.title}</p>
              <p className="mt-1 text-xs text-[#3a689f]">{t(`audience.label.${announcement.audience}`)}</p>
            </div>
            <Link
              href="/dashboard/announcements"
              className="text-xs font-semibold text-[#1f518f] underline"
            >
              {t("action.backToAnnouncements")}
            </Link>
          </div>

          <p className="mt-3 whitespace-pre-wrap text-sm text-[#2f5d96]">{announcement.content}</p>

          <div className="mt-4 grid gap-1 text-xs text-[#3f70ae]">
            <span>{t("posted")}: {formatDate(announcement.createdAt)}</span>
            <span>{t("expires")}: {formatDate(announcement.expiresAt)}</span>
          </div>

          <div className="mt-4">
            <AnnouncementDetailActions
              id={announcement.id}
              title={announcement.title}
              backHref="/dashboard/announcements"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
