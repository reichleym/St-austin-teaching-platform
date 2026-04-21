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
        donationsSections: {
          orderBy: { position: "asc" },
        },
        admissionsSections: {
          orderBy: { position: "asc" },
        },
        tuitionSections: {
          orderBy: { position: "asc" },
        },
        governmentEmployeesSections: {
          orderBy: { position: "asc" },
        },
      },
    });

    if (!page || !page.published) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const p = page as any;
    const resolvedSections = (() => {
      if (params.slug === "studentExperience") {
        return p.studentExperienceSections && p.studentExperienceSections.length > 0
          ? p.studentExperienceSections
          : p.sections;
      }
      if (params.slug === "donations") {
        return p.donationsSections && p.donationsSections.length > 0
          ? p.donationsSections
          : p.sections;
      }
      if (params.slug === "admissions") {
        return p.admissionsSections && p.admissionsSections.length > 0
          ? p.admissionsSections
          : p.sections;
      }
      if (params.slug === "tuition") {
        return p.tuitionSections && p.tuitionSections.length > 0
          ? p.tuitionSections
          : p.sections;
      }
      if (params.slug === "government-employees") {
        return p.governmentEmployeesSections && p.governmentEmployeesSections.length > 0
          ? p.governmentEmployeesSections
          : p.sections;
      }
      return p.sections;
    })();

    if (!resolvedSections || resolvedSections.length === 0) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json({ ...page, sections: resolvedSections });
  } catch (error) {
    console.error("Error fetching page:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
