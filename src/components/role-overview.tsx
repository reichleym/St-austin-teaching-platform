import { Role } from "@prisma/client";

type RoleOverviewProps = {
  role: Role;
  name?: string | null;
};

type Metric = {
  label: string;
  value: string;
  delta: string;
};

type FocusItem = {
  title: string;
  detail: string;
  priority: "High" | "Medium" | "Low";
};

function getOverviewModel(role: Role) {
  if (role === Role.SUPER_ADMIN) {
    return {
      heading: "Institution Operations",
      summary: "Governance, staffing, onboarding, and platform reliability across all schools and terms.",
      metrics: [
        { label: "Governance Scope", value: "Platform-wide", delta: "Single-admin authority" },
        { label: "Open Invitations", value: "126", delta: "Teachers and students pending" },
        { label: "Grade Edit Requests", value: "9", delta: "Awaiting final approval" },
      ] as Metric[],
      focus: [
        {
          title: "User & access governance",
          detail: "Enrollment lifecycle and access policy enforcement are active for this cycle.",
          priority: "High",
        },
        {
          title: "Academic oversight approvals",
          detail: "Pending approvals and academic integrity checks require review.",
          priority: "Medium",
        },
        {
          title: "Policy and configuration alignment",
          detail: "System-wide academic and platform controls remain in governance scope.",
          priority: "Low",
        },
      ] as FocusItem[],
      timeline: [
        "09:00 Governance sync with Academic Affairs",
        "11:30 User lifecycle and access review",
        "14:00 Grade edit approvals and policy checks",
        "16:30 Global announcement and compliance checkpoint",
      ],
    };
  }

  if (role === Role.TEACHER) {
    return {
      heading: "Teaching Command Center",
      summary: "Course delivery, grading throughput, engagement signals, and learner support workflow.",
      metrics: [
        { label: "Classes Today", value: "5", delta: "2 with lab sessions" },
        { label: "Submissions Pending", value: "42", delta: "13 due in 24 hours" },
        { label: "Avg Class Engagement", value: "88%", delta: "+6% from last week" },
      ] as Metric[],
      focus: [
        {
          title: "Grade week 6 assessments",
          detail: "Prioritize Grade 10 Science and Algebra before Friday closure.",
          priority: "High",
        },
        {
          title: "Flag at-risk learners",
          detail: "6 students below attendance and assignment threshold.",
          priority: "Medium",
        },
        {
          title: "Publish next lesson resources",
          detail: "Attach rubric and worksheet links to tomorrow's classes.",
          priority: "Low",
        },
      ] as FocusItem[],
      timeline: [
        "08:30 Grade 10 Algebra",
        "10:15 Grade 9 Science",
        "13:00 Office hours and parent queries",
        "15:30 Assessment moderation",
      ],
    };
  }

  return {
    heading: "Student Learning Hub",
    summary: "Academic progress, deadlines, attendance performance, and personal learning actions.",
    metrics: [
      { label: "Current GPA", value: "3.72", delta: "+0.14 this term" },
      { label: "Assignments Due", value: "4", delta: "2 due this week" },
      { label: "Attendance Rate", value: "94%", delta: "On track for honors" },
    ] as Metric[],
    focus: [
      {
        title: "Complete Mathematics assignment set",
        detail: "Chapter 6 worksheet and quiz close on Thursday at 11:59 PM.",
        priority: "High",
      },
      {
        title: "Prepare for Biology practical",
        detail: "Review microscope and cell structure lab instructions.",
        priority: "Medium",
      },
      {
        title: "Update learning goals",
        detail: "Set target score for next two assessments.",
        priority: "Low",
      },
    ] as FocusItem[],
    timeline: [
      "09:00 Mathematics",
      "11:00 Biology Lab",
      "13:30 English Literature",
      "16:00 Guided study session",
    ],
  };
}

function PriorityBadge({ priority }: { priority: FocusItem["priority"] }) {
  const tone =
    priority === "High"
      ? "bg-[#fee6e6] text-[#9b1c1c] border-[#f3b8b8]"
      : priority === "Medium"
        ? "bg-[#fff5de] text-[#805900] border-[#f3d290]"
        : "bg-[#e8f6ec] text-[#1a6f3e] border-[#b8e3c9]";

  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>{priority}</span>;
}

export function RoleOverview({ role, name }: RoleOverviewProps) {
  const model = getOverviewModel(role);
  const displayName =
    name?.trim() || (role === Role.SUPER_ADMIN ? "Administrator" : role === Role.TEACHER ? "Faculty" : "Student");

  return (
    <section className="grid gap-4">
      <article className="brand-card p-6">
        <p className="brand-section-title">Overview</p>
        <h3 className="mt-2 text-2xl font-bold text-[#0b3e81]">{model.heading}</h3>
        <p className="brand-muted mt-2 max-w-3xl">{model.summary}</p>
        <p className="mt-3 text-sm text-[#2a5e9e]">
          Signed in as <span className="font-semibold text-[#0b3e81]">{displayName}</span>
        </p>
      </article>

      <div className="grid gap-4 md:grid-cols-3">
        {model.metrics.map((item) => (
          <article key={item.label} className="brand-card p-5">
            <p className="brand-section-title">{item.label}</p>
            <p className="mt-2 text-3xl font-black text-[#0b3e81]">{item.value}</p>
            <p className="mt-1 text-xs font-semibold text-[#2a66a8]">{item.delta}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <article className="brand-card p-5">
          <p className="brand-section-title">Priority Queue</p>
          <div className="mt-3 space-y-3">
            {model.focus.map((item) => (
              <div key={item.title} className="rounded-xl border border-[#c6ddfa] bg-[#f4f9ff] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#0b3e81]">{item.title}</p>
                  <PriorityBadge priority={item.priority} />
                </div>
                <p className="mt-1 text-sm text-[#2f5d96]">{item.detail}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="brand-card p-5">
          <p className="brand-section-title">Today</p>
          <div className="mt-3 space-y-2">
            {model.timeline.map((entry) => (
              <div key={entry} className="flex items-start gap-2 rounded-lg border border-[#cee2fb] bg-white/75 px-3 py-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-[#1b6fc7]" />
                <p className="text-sm text-[#1f508f]">{entry}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

    </section>
  );
}
