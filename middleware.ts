import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { getToken } from "next-auth/jwt";
import { getRoleHomePath } from "@/lib/role-routing";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith("/dashboard/admin");
  const isProtectedRoute = pathname.startsWith("/dashboard");
  const isUserAuthRoute = pathname === "/login" || pathname.startsWith("/register");
  const isAdminAuthRoute = pathname === "/admin/login";
  const isAuthRoute = isUserAuthRoute || isAdminAuthRoute;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isLoggedIn = Boolean(token);

  if (isAuthRoute && isLoggedIn) {
    const redirectTo = getRoleHomePath(token?.role as Role | undefined);
    return NextResponse.redirect(new URL(redirectTo, req.nextUrl.origin));
  }

  if (!token && isProtectedRoute) {
    const loginUrl = new URL(isAdminRoute ? "/admin/login" : "/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const tokenRole = String(token?.role ?? "");
  if (isAdminRoute && tokenRole !== Role.SUPER_ADMIN && tokenRole !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register/:path*", "/admin/login"],
};
