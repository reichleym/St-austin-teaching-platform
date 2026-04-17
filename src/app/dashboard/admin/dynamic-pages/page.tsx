import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import AdminDynamicPagesManager from "@/components/admin-dynamic-pages-manager";

export const metadata = {
  title: "Website Pages | Admin",
};

export default async function DynamicPagesAdminPage() {
  const session = await getServerSession();

  if (!session || session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="w-full">
      <AdminDynamicPagesManager />
    </div>
  );
}
