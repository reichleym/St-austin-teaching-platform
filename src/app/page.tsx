import Link from "next/link";
import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { getRoleHomePath } from "@/lib/role-routing";
import HomePageEditor from "@/components/home-page-editor";

const formatRoleLabel = (role: string) => role.replace(/_/g, " ");

export default async function Home() {
  const session = await auth();

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-semibold">St. Austin Teaching Platform</h1>
      {session?.user ? (
        <div className="mt-4 space-y-3">
          <p>
            Signed in as {session.user.email} ({formatRoleLabel(session.user.role)})
          </p>
          <div className="space-x-4">
            <Link href={getRoleHomePath(session.user.role)} className="underline">
              Dashboard
            </Link>
            {session.user.role === Role.SUPER_ADMIN ? (
              <>
                <Link href="/dashboard/overview" className="underline">
                  Super Admin
                </Link>
                <div className="mt-6">
                  <HomePageEditor />
                </div>
              </>
            ) : null}
          </div>
          <LogoutButton role={session.user.role} />
        </div>
      ) : (
        <div className="mt-4 space-x-4">
          <Link href="/admin/login" className="underline">
            Admin Login
          </Link>
          <Link href="/login" className="underline">
            Teacher/Student Login
          </Link>
        </div>
      )}
    </main>
  );
}
