import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { isTeacherRole } from "@/lib/courses";
import { isSuperAdminRole } from "@/lib/permissions";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CourseStudentsPage({ params }: Props) {
  const session = await auth();

  if (!session?.user || session.user.status !== "ACTIVE") {
    redirect("/login");
  }

  const routeParams = await params;
  const courseId = routeParams.id;
  const roleKey = String(session.user.role ?? "");
  const isSuperAdmin = isSuperAdminRole(roleKey);
  const isTeacher = isTeacherRole(roleKey);

  if (!isSuperAdmin && !isTeacher) {
    redirect("/dashboard/courses");
  }

  const course = await prisma.course.findFirst({
    where: isSuperAdmin ? { id: courseId } : { id: courseId, teacherId: session.user.id },
    select: {
      id: true,
      code: true,
      title: true,
    },
  });

  if (!course) {
    redirect("/dashboard/courses");
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: course.id, status: "ACTIVE" },
    select: {
      student: {
        select: { id: true, name: true, email: true, studentId: true, status: true },
      },
    },
    orderBy: [{ student: { name: "asc" } }, { student: { email: "asc" } }],
  });

  const students = enrollments.map((row) => row.student).filter(Boolean);

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
                Enrolled Students
              </span>
              <h1 className="brand-title brand-title-gradient mt-3 text-3xl font-black">
                {course.code} - {course.title}
              </h1>
              <p className="brand-muted mt-2 text-sm">Active enrollments for this course.</p>
            </div>
            <Link
              href={`/dashboard/courses/${course.id}`}
              className="rounded-md border border-[#9bbfed] bg-white px-4 py-2 text-sm font-semibold text-[#1f518f]"
            >
              Back to Course
            </Link>
          </div>
        </section>

        <section className="brand-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="brand-section-title">Enrolled Students</p>
            <span className="text-xs font-semibold text-[#2a5e9e]">Total: {students.length}</span>
          </div>
          {students.length ? (
            <div className="mt-3 grid gap-2 text-sm">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#dbe9fb] bg-white/80 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0b3e81]">
                      {student.name || "Unnamed Student"}
                      {student.status === "DISABLED" ? " (DISABLED)" : ""}
                    </p>
                    <p className="text-xs text-[#3768ac]">
                      {student.studentId ? `${student.studentId} - ` : ""}
                      {student.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="brand-muted mt-3 text-sm">No enrolled students yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
