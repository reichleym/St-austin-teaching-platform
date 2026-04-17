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

    if (!page) {
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

    return NextResponse.json(page);
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

    // Delete existing sections for this page (table depends on slug)
    if (params.slug === "studentExperience") {
      await prisma.studentExperience.deleteMany({
        where: {
          page: { slug: params.slug },
        },
      });
    } else {
      await prisma.aboutPage.deleteMany({
        where: {
          page: { slug: params.slug },
        },
      });
    }

    const createPayload = normalizedSections.map((section, index) => ({
      sectionKey: section.sectionKey,
      componentType: section.componentType,
      position: index,
      content: section.content,
    }));

    // Update page and create new sections (relation depends on slug)
    const page = await prisma.dynamicPage.update({
      where: { slug: params.slug },
      data: {
        title,
        published,
        updatedById: session.user.id,
        ...(params.slug === "studentExperience"
          ? {
              studentExperienceSections: {
                create: createPayload,
              },
            }
          : {
              sections: {
                create: createPayload,
              },
            }),
      },
      include: {
        sections: {
          orderBy: { position: "asc" },
        },
        studentExperienceSections: {
          orderBy: { position: "asc" },
        },
      },
    });

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

    return NextResponse.json(page);
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
