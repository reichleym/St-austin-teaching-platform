import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { StudentProgressModule } from "@/components/student-progress-module";
import { isTeacherRole } from "@/lib/courses";
import { isSuperAdminRole } from "@/lib/permissions";

type Props = {
  params: Promise<{ id: string }>;
};

async function getDepartmentHeadCourseIds(userId: string) {
  try {
    const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public."DepartmentHeadCourseAssignment"') IS NOT NULL AS "exists"
    `;
    if (!tableExists[0]?.exists) return [] as string[];
    const rows = await prisma.$queryRaw<Array<{ courseId: string }>>`
      SELECT "courseId"
      FROM "DepartmentHeadCourseAssignment"
      WHERE "departmentHeadId" = ${userId}
    `;
    return rows.map((row) => row.courseId);
  } catch {
    return [] as string[];
  }
}

export default async function CourseProgressPage({ params }: Props) {
  const session = await auth();

  if (!session?.user || session.user.status !== "ACTIVE") {
    redirect("/login");
  }

  const routeParams = await params;
  const courseId = routeParams.id;
  const roleKey = String(session.user.role ?? "");

  const isSuperAdmin = isSuperAdminRole(roleKey);
  const isTeacher = isTeacherRole(roleKey);
  const isStudent = roleKey === "STUDENT";
  const isDepartmentHead = roleKey === "DEPARTMENT_HEAD";
  if (!isSuperAdmin && !isTeacher && !isStudent && !isDepartmentHead) {
    redirect(`/dashboard/courses/${courseId}`);
  }

  const departmentHeadCourseIds = isDepartmentHead ? await getDepartmentHeadCourseIds(session.user.id) : [];
  if (isDepartmentHead && !departmentHeadCourseIds.includes(courseId)) {
    redirect("/dashboard/courses");
  }

  const course = await prisma.course.findFirst({
    where: isSuperAdmin
      ? { id: courseId }
      : isTeacher
        ? { id: courseId, teacherId: session.user.id }
        : isDepartmentHead
          ? { id: courseId }
          : {
            id: courseId,
            enrollments: { some: { studentId: session.user.id, status: "ACTIVE" } },
          },
    select: { id: true, code: true, title: true },
  });

  if (!course) {
    redirect("/dashboard/courses");
  }

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
                Student Progress
              </span>
              <h1 className="brand-title brand-title-gradient mt-3 text-3xl font-black">
                {course.code} - {course.title}
              </h1>
              <p className="brand-muted mt-2 text-sm">Review learner progress for this course.</p>
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

        <StudentProgressModule
          role={roleKey as "SUPER_ADMIN" | "ADMIN" | "DEPARTMENT_HEAD" | "TEACHER" | "STUDENT"}
          courseId={course.id}
        />
      </div>
    </main>
  );
}
