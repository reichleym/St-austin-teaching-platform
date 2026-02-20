import Link from "next/link";
import { auth } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export default async function Home() {
  const session = await auth();

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-semibold">St. Austin Teaching Platform</h1>
      {session?.user ? (
        <div className="mt-4 space-y-3">
          <p>
            Signed in as {session.user.email} ({session.user.role})
          </p>
          <div className="space-x-4">
            <Link href="/dashboard" className="underline">
              Dashboard
            </Link>
            {session.user.role === "ADMIN" ? (
              <Link href="/dashboard?module=admin-controls" className="underline">
                Admin
              </Link>
            ) : null}
          </div>
          <LogoutButton />
        </div>
      ) : (
        <p className="mt-4">
          <Link href="/login" className="underline">
            Login
          </Link>
        </p>
      )}
    </main>
  );
}
