import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  const params = await props.params;
  try {
    const page = await prisma.dynamicPage.findUnique({
      where: { slug: params.slug },
      include: {
        sections: {
          orderBy: { position: "asc" },
        },
        studentExperienceSections: {
          orderBy: { position: "asc" },
        },
      },
    });

    if (!page || !page.published) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    if (params.slug === "studentExperience") {
      const resolvedSections =
        page.studentExperienceSections && page.studentExperienceSections.length > 0
          ? page.studentExperienceSections
          : page.sections;
      return NextResponse.json({
        ...page,
        sections: resolvedSections,
      });
    }

    if (!page.sections || page.sections.length === 0) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json(page);
  } catch (error) {
    console.error("Error fetching page:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
