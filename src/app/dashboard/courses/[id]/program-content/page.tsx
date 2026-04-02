import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/permissions";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { CourseProgramContentEditor } from "@/components/course-program-content-editor";

type Props = {
  params: Promise<{ id: string }>;
};

type ProgramDetails = {
  overview: string | null;
  tuitionAndFees: string | null;
  curriculum: string[];
  admissionRequirements: string[];
  careerOpportunities: string[];
};

const normalizeProgramText = (input: unknown) => {
  if (typeof input !== "string") return null;
  const value = input.trim();
  return value ? value : null;
};

const normalizeProgramList = (input: unknown) => {
  if (!Array.isArray(input)) return [] as string[];
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 50);
};

const parseProgramContent = (raw: string | null | undefined): ProgramDetails | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const value = parsed as Record<string, unknown>;
    const details: ProgramDetails = {
      overview: normalizeProgramText(value.overview),
      tuitionAndFees: normalizeProgramText(value.tuitionAndFees),
      curriculum: normalizeProgramList(value.curriculum),
      admissionRequirements: normalizeProgramList(value.admissionRequirements),
      careerOpportunities: normalizeProgramList(value.careerOpportunities),
    };

    if (
      !details.overview &&
      !details.tuitionAndFees &&
      !details.curriculum.length &&
      !details.admissionRequirements.length &&
      !details.careerOpportunities.length
    ) {
      return null;
    }

    return details;
  } catch {
    return null;
  }
};

export default async function CourseProgramContentPage({ params }: Props) {
  const session = await auth();

  if (!session?.user || session.user.status !== "ACTIVE") {
    redirect("/login");
  }

  const roleKey = String(session.user.role ?? "");
  if (!isSuperAdminRole(roleKey)) {
    redirect("/dashboard/courses");
  }

  const routeParams = await params;
  const courseId = routeParams.id;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, code: true, title: true },
  });

  if (!course) {
    redirect("/dashboard/courses");
  }

  const programDetails = await prisma
    .$queryRaw<Array<{ programContent: string | null }>>`
      SELECT "programContent"
      FROM "Course"
      WHERE "id" = ${course.id}
      LIMIT 1
    `
    .then((rows) => parseProgramContent(rows[0]?.programContent ?? null))
    .catch(() => null);

  return (
    <main className="min-h-screen lg:flex">
      <DashboardSidebar role={roleKey} selectedSlug="courses" />
      <div className="flex-1 space-y-6 p-6 lg:p-8">
        <DashboardTopbar name={session.user.name} email={session.user.email} role={roleKey} />

        <section className="brand-glass brand-animate p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="brand-chip">
                <span className="brand-accent-dot" />
                Program Content
              </span>
              <h1 className="brand-title brand-title-gradient mt-3 text-3xl font-black">
                {course.code} - {course.title}
              </h1>
              <p className="brand-muted mt-2 text-sm">
                Manage the website-facing program content for this course.
              </p>
            </div>
            <Link
              href={`/dashboard/courses/${course.id}`}
              aria-label="Back to course"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#9bbfed] bg-white text-[#1f518f] shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
          </div>
        </section>

        <CourseProgramContentEditor
          courseId={course.id}
          initialProgramDetails={programDetails}
        />
      </div>
    </main>
  );
}
