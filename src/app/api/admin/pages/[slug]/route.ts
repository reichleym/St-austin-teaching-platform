import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function withDevDetails(payload: Record<string, unknown>, error: unknown) {
  if (process.env.NODE_ENV !== "development") return payload;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in (error as Record<string, unknown>)
          ? String((error as Record<string, unknown>).message)
          : String(error);
  return { ...payload, details: message };
}

function dbSummary() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return {
      host: url.hostname,
      port: url.port || null,
      database: url.pathname.replace(/^\//, "") || null,
    };
  } catch {
    return null;
  }
}

function dynamicPagesMissingTablesResponse(error: Prisma.PrismaClientKnownRequestError) {
  const rawTable =
    error.meta && typeof error.meta === "object" && "table" in error.meta
      ? (error.meta as Record<string, unknown>).table
      : undefined;
  const table = typeof rawTable === "string" ? rawTable : "";
  const tableName = table.includes(".") ? table.split(".").at(-1) ?? table : table;

  const message = (() => {
    if (tableName) {
      if (tableName === "PageSection") {
        return 'Database table "PageSection" is missing. If you recently renamed it to "AboutPage", restart the dev server and run `npm run db:generate`.';
      }
      return `Database table "${tableName}" is missing. Run \`npm run db:migrate\` and restart the dev server.`;
    }

    return "Dynamic Pages tables are missing. Run `npm run db:migrate` and restart the dev server.";
  })();

  return {
    error: message,
    table: tableName || null,
    database: dbSummary(),
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  };
}

function parseSections(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const sectionKey = typeof record.sectionKey === "string" ? record.sectionKey : "";
    const componentType = typeof record.componentType === "string" ? record.componentType : "";
    if (!sectionKey || !componentType) return [];

    return [
      {
        sectionKey,
        componentType,
        content: record.content as Prisma.InputJsonValue,
      },
    ];
  });
}

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  const params = await props.params;
  try {
    // Use the generic DynamicPage tables for all pages (AboutPage-style sections)

    // Fallback to generic dynamicPage — include all per-page section relations
    const page = await prisma.dynamicPage.findUnique({
      where: { slug: params.slug },
      include: {
        sections: { orderBy: { position: "asc" } },
        studentExperienceSections: { orderBy: { position: "asc" } },
        donationsSections: { orderBy: { position: "asc" } },
        admissionsSections: { orderBy: { position: "asc" } },
        tuitionSections: { orderBy: { position: "asc" } },
        governmentEmployeesSections: { orderBy: { position: "asc" } },
        homeSections: { orderBy: { position: "asc" } },
      },
    });

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Resolve the proper sections array for the requested slug
    const p = page as any;
    const resolvedSections = (() => {
      if (params.slug === "studentExperience") return (p.studentExperienceSections && p.studentExperienceSections.length > 0) ? p.studentExperienceSections : p.sections;
      if (params.slug === "donations") return (p.donationsSections && p.donationsSections.length > 0) ? p.donationsSections : p.sections;
      if (params.slug === "admissions") return (p.admissionsSections && p.admissionsSections.length > 0) ? p.admissionsSections : p.sections;
      if (params.slug === "tuition") return (p.tuitionSections && p.tuitionSections.length > 0) ? p.tuitionSections : p.sections;
      if (params.slug === "government-employees") return (p.governmentEmployeesSections && p.governmentEmployeesSections.length > 0) ? p.governmentEmployeesSections : p.sections;
      if (params.slug === "home") return (p.homeSections && p.homeSections.length > 0) ? p.homeSections : p.sections;
      return p.sections;
    })();

    if (!resolvedSections || resolvedSections.length === 0) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json({ ...page, sections: resolvedSections });
  } catch (error) {
    if (error instanceof TypeError) {
      return NextResponse.json(
        { error: "Prisma Client is out of date. Run `npm run db:generate` and restart the dev server." },
        { status: 500 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      const payload = dynamicPagesMissingTablesResponse(error);
      console.error("Dynamic Pages P2021 (missing table)", payload);
      return NextResponse.json(
        payload,
        { status: 500 }
      );
    }

    console.error("Error fetching page:", error);
    return NextResponse.json(
      withDevDetails({ error: "Internal server error" }, error),
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, published, sections } = body;

    const normalizedSections = parseSections(sections);
    const createPayload = normalizedSections.map((section, index) => ({
      sectionKey: section.sectionKey,
      componentType: section.componentType,
      position: index,
      content: section.content,
    }));

    // For all pages, use DynamicPage + AboutPage-style `sections` entries.

    // Delete existing sections for this page (model depends on slug)
    if (params.slug === "studentExperience") {
      await prisma.studentExperience.deleteMany({ where: { page: { slug: params.slug } } });
    } else if (params.slug === "home") {
      await prisma.homeSection.deleteMany({ where: { page: { slug: params.slug } } });
    } else if (params.slug === "donations") {
      await prisma.donationsSection.deleteMany({ where: { page: { slug: params.slug } } });
    } else if (params.slug === "admissions") {
      await prisma.admissionsSection.deleteMany({ where: { page: { slug: params.slug } } });
    } else if (params.slug === "tuition") {
      await prisma.tuitionSection.deleteMany({ where: { page: { slug: params.slug } } });
    } else if (params.slug === "government-employees") {
      await prisma.governmentEmployeesSection.deleteMany({ where: { page: { slug: params.slug } } });
    } else {
      await prisma.aboutPage.deleteMany({ where: { page: { slug: params.slug } } });
    }

    // Upsert page (never "create new slug" accidentally).
    const upsertArgs: any = {
      where: { slug: params.slug },
      update: {
        title,
        published,
        updatedById: session.user.id,
      },
      create: {
        slug: params.slug,
        title: typeof title === "string" && title.trim() ? title : params.slug,
        published: !!published,
        updatedById: session.user.id,
      },
      include: {
        sections: { orderBy: { position: "asc" } },
        studentExperienceSections: { orderBy: { position: "asc" } },
        donationsSections: { orderBy: { position: "asc" } },
        admissionsSections: { orderBy: { position: "asc" } },
        tuitionSections: { orderBy: { position: "asc" } },
        governmentEmployeesSections: { orderBy: { position: "asc" } },
        homeSections: { orderBy: { position: "asc" } },
      },
    };

    // Attach create payload to the correct relation based on slug
    if (params.slug === "studentExperience") {
      upsertArgs.update.studentExperienceSections = { create: createPayload };
      upsertArgs.create.studentExperienceSections = { create: createPayload };
    } else if (params.slug === "donations") {
      upsertArgs.update.donationsSections = { create: createPayload };
      upsertArgs.create.donationsSections = { create: createPayload };
    } else if (params.slug === "admissions") {
      upsertArgs.update.admissionsSections = { create: createPayload };
      upsertArgs.create.admissionsSections = { create: createPayload };
    } else if (params.slug === "tuition") {
      upsertArgs.update.tuitionSections = { create: createPayload };
      upsertArgs.create.tuitionSections = { create: createPayload };
    } else if (params.slug === "government-employees") {
      upsertArgs.update.governmentEmployeesSections = { create: createPayload };
      upsertArgs.create.governmentEmployeesSections = { create: createPayload };
    } else if (params.slug === "home") {
      upsertArgs.update.homeSections = { create: createPayload };
      upsertArgs.create.homeSections = { create: createPayload };
    } else {
      upsertArgs.update.sections = { create: createPayload };
      upsertArgs.create.sections = { create: createPayload };
    }

    const page = await prisma.dynamicPage.upsert(upsertArgs);

    // Resolve returned sections similarly to GET
    const p = page as any;
    const resolved = (() => {
      if (params.slug === "studentExperience") return (p.studentExperienceSections && p.studentExperienceSections.length > 0) ? p.studentExperienceSections : p.sections;
      if (params.slug === "donations") return (p.donationsSections && p.donationsSections.length > 0) ? p.donationsSections : p.sections;
      if (params.slug === "admissions") return (p.admissionsSections && p.admissionsSections.length > 0) ? p.admissionsSections : p.sections;
      if (params.slug === "tuition") return (p.tuitionSections && p.tuitionSections.length > 0) ? p.tuitionSections : p.sections;
      if (params.slug === "government-employees") return (p.governmentEmployeesSections && p.governmentEmployeesSections.length > 0) ? p.governmentEmployeesSections : p.sections;
      if (params.slug === "home") return (p.homeSections && p.homeSections.length > 0) ? p.homeSections : p.sections;
      return p.sections;
    })();

    return NextResponse.json({ ...page, sections: resolved });
  } catch (error) {
    if (error instanceof TypeError) {
      return NextResponse.json(
        { error: "Prisma Client is out of date. Run `npm run db:generate` and restart the dev server." },
        { status: 500 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2021") {
        const payload = dynamicPagesMissingTablesResponse(error);
        console.error("Dynamic Pages P2021 (missing table)", payload);
        return NextResponse.json(
          payload,
          { status: 500 }
        );
      }
      // Note: upsert removes the "page not found" case here.
    }

    console.error("Error updating page:", error);
    return NextResponse.json(
      withDevDetails({ error: "Internal server error" }, error),
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.dynamicPage.delete({
      where: { slug: params.slug },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TypeError) {
      return NextResponse.json(
        { error: "Prisma Client is out of date. Run `npm run db:generate` and restart the dev server." },
        { status: 500 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2021") {
        const payload = dynamicPagesMissingTablesResponse(error);
        console.error("Dynamic Pages P2021 (missing table)", payload);
        return NextResponse.json(
          payload,
          { status: 500 }
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Page not found" }, { status: 404 });
      }
    }

    console.error("Error deleting page:", error);
    return NextResponse.json(
      withDevDetails({ error: "Internal server error" }, error),
      { status: 500 }
    );
  }
}
