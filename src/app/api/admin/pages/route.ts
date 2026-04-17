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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pages = await prisma.dynamicPage.findMany({
      include: {
        sections: {
          orderBy: { position: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(pages);
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

    console.error("Error fetching pages:", error);
    return NextResponse.json(
      withDevDetails({ error: "Internal server error" }, error),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { slug, title, published = false, sections = [] } = body;

    if (!slug || !title) {
      return NextResponse.json(
        { error: "slug and title are required" },
        { status: 400 }
      );
    }

    const normalizedSections = parseSections(sections);

    const page = await prisma.dynamicPage.create({
      data: {
        slug,
        title,
        published,
        updatedById: session.user.id,
        sections: {
          create: normalizedSections.map((section, index) => ({
            sectionKey: section.sectionKey,
            componentType: section.componentType,
            position: index,
            content: section.content,
          })),
        },
      },
      include: {
        sections: {
          orderBy: { position: "asc" },
        },
      },
    });

    return NextResponse.json(page, { status: 201 });
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
      if (error.code === "P2002") {
        return NextResponse.json({ error: "A page with this slug already exists." }, { status: 409 });
      }
    }

    console.error("Error creating page:", error);
    return NextResponse.json(
      withDevDetails({ error: "Internal server error" }, error),
      { status: 500 }
    );
  }
}
