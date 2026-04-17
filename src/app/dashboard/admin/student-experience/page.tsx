import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import StudentExperienceEditor from "@/components/student-experience-editor";

export default async function StudentExperienceAdminPage() {
  const session = await getServerSession(authOptions);

  // SUPER_ADMIN only
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="w-full p-6">
      <StudentExperienceEditor />
    </div>
  );
}
