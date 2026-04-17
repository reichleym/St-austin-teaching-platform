import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { seedAboutPage } from "@/lib/seed-about-page";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const page = await seedAboutPage();
    return NextResponse.json({
      success: true,
      message: "About page seeded successfully",
      page,
    });
  } catch (error) {
    console.error("Error seeding page:", error);
    return NextResponse.json(
      { error: "Failed to seed page" },
      { status: 500 }
    );
  }
}
