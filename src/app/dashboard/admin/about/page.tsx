import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import AboutPageEditor from "@/components/about-page-editor";

export const metadata = {
  title: "About Page | Admin",
};

export default async function AboutPageAdminPage() {
  const session = await getServerSession();

  if (!session || session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="w-full">
      <AboutPageEditor />
    </div>
  );
}
