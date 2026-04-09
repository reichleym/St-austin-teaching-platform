"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
type RoleKey = "SUPER_ADMIN" | "DEPARTMENT_HEAD" | "TEACHER" | "STUDENT" | "ADMIN" | string;

type RoleOverviewProps = {
  role: RoleKey;
  name?: string | null;
};

type Metric = {
  label: string;
  value: string | number;
  delta: string;
  href?: string;
};

type FocusItem = {
  title: string;
  detail: string;
  priority: "High" | "Medium" | "Low";
};

type DynamicOverview = {
  metrics: Metric[];
  focus?: FocusItem[];
  timeline?: string[];
};

type Translator = (key: string, vars?: Record<string, string | number>, fallback?: string) => string;

function getOverviewModel(roleKey: RoleKey, t: Translator, dynamicOverview?: DynamicOverview) {
  if (roleKey === "SUPER_ADMIN" || roleKey === "ADMIN") {
    return {
      heading: t("overview.superAdmin.heading"),
      summary: t("overview.superAdmin.summary"),
      metrics:
        dynamicOverview?.metrics ?? [
          { label: t("metric.announcements"), value: 0, delta: t("metric.announcements.delta"), href: "/dashboard/announcements" },
          { label: t("metric.courses"), value: 0, delta: t("metric.courses.delta"), href: "/dashboard/courses" },
          { label: t("metric.gradeEdit"), value: 0, delta: t("metric.gradeEdit.delta"), href: "/dashboard/assessment" },
        ],
      focus: [
        {
          title: t("focus.superAdmin.userAccess.title"),
          detail: t("focus.superAdmin.userAccess.detail"),
          priority: "High",
        },
        {
          title: t("focus.superAdmin.academic.title"),
          detail: t("focus.superAdmin.academic.detail"),
          priority: "Medium",
        },
        {
          title: t("focus.superAdmin.policy.title"),
          detail: t("focus.superAdmin.policy.detail"),
          priority: "Low",
        },
      ] as FocusItem[],
      timeline: [
        t("timeline.superAdmin.1"),
        t("timeline.superAdmin.2"),
        t("timeline.superAdmin.3"),
        t("timeline.superAdmin.4"),
      ],
      ...(dynamicOverview?.focus?.length ? { focus: dynamicOverview.focus } : {}),
      ...(dynamicOverview?.timeline !== undefined ? { timeline: dynamicOverview.timeline } : {}),
    };
  }

  if (roleKey === "DEPARTMENT_HEAD") {
    return {
      heading: t("overview.departmentHead.heading"),
      summary: t("overview.departmentHead.summary"),
      metrics:
        dynamicOverview?.metrics ?? [
          { label: t("metric.coursesOverseen"), value: 0, delta: t("metric.coursesOverseen.delta"), href: "/dashboard/courses" },
          { label: t("metric.discussionFlags"), value: 0, delta: t("metric.discussionFlags.delta"), href: "/dashboard/engagement" },
          { label: t("metric.assignments"), value: 0, delta: t("metric.assignments.deltaDept"), href: "/dashboard/assessment" },
        ],
      focus: [
        {
          title: t("focus.departmentHead.delivery.title"),
          detail: t("focus.departmentHead.delivery.detail"),
          priority: "High",
        },
        {
          title: t("focus.departmentHead.discussion.title"),
          detail: t("focus.departmentHead.discussion.detail"),
          priority: "Medium",
        },
        {
          title: t("focus.departmentHead.pacing.title"),
          detail: t("focus.departmentHead.pacing.detail"),
          priority: "Low",
        },
      ] as FocusItem[],
      timeline: [
        t("timeline.departmentHead.1"),
        t("timeline.departmentHead.2"),
        t("timeline.departmentHead.3"),
        t("timeline.departmentHead.4"),
      ],
      ...(dynamicOverview?.focus?.length ? { focus: dynamicOverview.focus } : {}),
      ...(dynamicOverview?.timeline !== undefined ? { timeline: dynamicOverview.timeline } : {}),
    };
  }

  if (roleKey === "TEACHER") {
    return {
      heading: t("overview.teacher.heading"),
      summary: t("overview.teacher.summary"),
      metrics:
        dynamicOverview?.metrics ?? [
          { label: t("metric.assignedCourses"), value: 0, delta: t("metric.assignedCourses.delta"), href: "/dashboard/courses" },
          { label: t("metric.submissionsPending"), value: 0, delta: t("metric.submissionsPending.delta"), href: "/dashboard/assessment" },
          { label: t("metric.assignments"), value: 0, delta: t("metric.assignments.deltaTeacher"), href: "/dashboard/assessment" },
        ],
      focus: [
        {
          title: t("focus.teacher.gradeWeek.title"),
          detail: t("focus.teacher.gradeWeek.detail"),
          priority: "High",
        },
        {
          title: t("focus.teacher.atRisk.title"),
          detail: t("focus.teacher.atRisk.detail"),
          priority: "Medium",
        },
        {
          title: t("focus.teacher.publishResources.title"),
          detail: t("focus.teacher.publishResources.detail"),
          priority: "Low",
        },
      ] as FocusItem[],
      timeline: [
        t("timeline.teacher.1"),
        t("timeline.teacher.2"),
        t("timeline.teacher.3"),
        t("timeline.teacher.4"),
      ],
      ...(dynamicOverview?.focus?.length ? { focus: dynamicOverview.focus } : {}),
      ...(dynamicOverview?.timeline !== undefined ? { timeline: dynamicOverview.timeline } : {}),
    };
  }

  return {
    heading: t("overview.student.heading"),
    summary: t("overview.student.summary"),
    metrics:
      dynamicOverview?.metrics ?? [
        { label: t("metric.enrolledCourses"), value: 0, delta: t("metric.enrolledCourses.delta"), href: "/dashboard/courses" },
        { label: t("metric.assignments"), value: 0, delta: t("metric.assignments.deltaStudent"), href: "/dashboard/assessment" },
        { label: t("metric.announcements"), value: 0, delta: t("metric.announcements.deltaStudent"), href: "/dashboard/announcements-feed" },
      ],
    focus: [
      {
        title: t("focus.student.math.title"),
        detail: t("focus.student.math.detail"),
        priority: "High",
      },
      {
        title: t("focus.student.bio.title"),
        detail: t("focus.student.bio.detail"),
        priority: "Medium",
      },
      {
        title: t("focus.student.goals.title"),
        detail: t("focus.student.goals.detail"),
        priority: "Low",
      },
    ] as FocusItem[],
    timeline: [
      t("timeline.student.1"),
      t("timeline.student.2"),
      t("timeline.student.3"),
      t("timeline.student.4"),
    ],
    ...(dynamicOverview?.focus?.length ? { focus: dynamicOverview.focus } : {}),
    ...(dynamicOverview?.timeline !== undefined ? { timeline: dynamicOverview.timeline } : {}),
  };
}

function PriorityBadge({ priority, t }: { priority: FocusItem["priority"]; t: Translator }) {
  const tone =
    priority === "High"
      ? "bg-[#fee6e6] text-[#9b1c1c] border-[#f3b8b8]"
      : priority === "Medium"
        ? "bg-[#fff5de] text-[#805900] border-[#f3d290]"
        : "bg-[#e8f6ec] text-[#1a6f3e] border-[#b8e3c9]";

  const label =
    priority === "High" ? t("priority.high") : priority === "Medium" ? t("priority.medium") : t("priority.low");

  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>;
}

export function RoleOverview({ role, name, overview }: RoleOverviewProps & { overview?: DynamicOverview }) {
  const { t } = useLanguage();
  const roleKey = String(role);
  const model = getOverviewModel(roleKey, t, overview);
  const displayName =
    name?.trim() ||
    (roleKey === "SUPER_ADMIN" || roleKey === "ADMIN"
      ? t("roleLabel.administrator")
      : roleKey === "DEPARTMENT_HEAD"
        ? t("roleLabel.departmentHead")
        : roleKey === "TEACHER"
          ? t("roleLabel.faculty")
          : t("roleLabel.student"));

  return (
    <section className="grid gap-4">
      <article className="brand-card p-6">
        <p className="brand-section-title">{t("overviewTitle")}</p>
        <h3 className="mt-2 text-2xl font-bold text-[#0b3e81]">{model.heading}</h3>
        <p className="brand-muted mt-2 max-w-3xl">{model.summary}</p>
        <p className="mt-3 text-sm text-[#2a5e9e]">
          {t("signedInAsLabel")} <span className="font-semibold text-[#0b3e81]">{displayName}</span>
        </p>
      </article>

      <div className="grid gap-4 md:grid-cols-3">
        {model.metrics.map((item) => (
          item.href ? (
            <Link key={item.label} href={item.href} className="block">
              <article className="brand-card p-5 transition hover:border-[#90b7eb] hover:shadow-[0_8px_24px_rgba(11,62,129,0.08)]">
                <p className="brand-section-title">{item.label}</p>
                <p className="mt-2 text-3xl font-black text-[#0b3e81]">{item.value}</p>
                <p className="mt-1 text-xs font-semibold text-[#2a66a8]">{item.delta}</p>
              </article>
            </Link>
          ) : (
            <article key={item.label} className="brand-card p-5">
              <p className="brand-section-title">{item.label}</p>
              <p className="mt-2 text-3xl font-black text-[#0b3e81]">{item.value}</p>
              <p className="mt-1 text-xs font-semibold text-[#2a66a8]">{item.delta}</p>
            </article>
          )
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <article className="brand-card p-5">
          <p className="brand-section-title">{t("priorityQueue")}</p>
          <div className="mt-3 space-y-3">
            {model.focus.map((item) => (
              <div key={item.title} className="rounded-xl border border-[#c6ddfa] bg-[#f4f9ff] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#0b3e81]">{item.title}</p>
                  <PriorityBadge priority={item.priority} t={t} />
                </div>
                <p className="mt-1 text-sm text-[#2f5d96]">{item.detail}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="brand-card p-5">
          <p className="brand-section-title">{t("today")}</p>
          <div className="mt-3 space-y-2">
            {model.timeline.length ? (
              model.timeline.map((entry) => (
                <div key={entry} className="flex items-start gap-2 rounded-lg border border-[#cee2fb] bg-white/75 px-3 py-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#1b6fc7]" />
                  <p className="text-sm text-[#1f508f]">{entry}</p>
                </div>
              ))
            ) : (
              <p className="brand-muted text-sm">{t("overview.today.noEvents", undefined, "No events yet")}</p>
            )}
          </div>
        </article>
      </div>

    </section>
  );
}
