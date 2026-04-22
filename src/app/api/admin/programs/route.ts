import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  PROGRAM_VISIBILITY_DRAFT,
  type ProgramVisibilityValue,
  generateProgramCodeCandidate,
  normalizeProgramDetailsInput,
  parseProgramContent,
  parseProgramVisibility,
  serializeProgramContent,
  validateProgramTitle,
  buildProgramLocalizationPayload,
} from "@/lib/programs";
import { isSuperAdminRole, PermissionError, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type ProgramDetailsInput = {
  overview?: string | null;
  tuitionAndFees?: string | null;
  curriculum?: string[];
  admissionRequirements?: string[];
  careerOpportunities?: string[];
};

type CreateBody = {
  title?: string;
  description?: string | null;
  programContent?: string | null;
  sourceLanguage?: string;
  translations?: unknown;
  visibility?: ProgramVisibilityValue;
  degreeLevel?: string | null;
  fieldOfStudy?: string | null;
  programDetails?: ProgramDetailsInput;
  courseIds?: string[];
};

type UpdateBody = CreateBody & {
  programId?: string;
};

type DeleteBody = {
  programId?: string;
};

type ProgramRecord = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  programContent: string | null;
  degreeLevel: string | null;
  fieldOfStudy: string | null;
  sourceLanguage: string;
  translations: Prisma.JsonValue | null;
  visibility: ProgramVisibilityValue;
  createdAt: Date;
};

type CourseOption = {
  id: string;
  code: string;
  title: string;
};

type RawProgramRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  programContent: string | null;
  degreeLevel: string | null;
  fieldOfStudy: string | null;
  sourceLanguage: string;
  translations: Prisma.JsonValue | null;
  visibility: ProgramVisibilityValue;
  createdAt: Date;
};

type RawProgramCourseRow = {
  programId: string;
  id: string;
  code: string;
  title: string;
};

function getProgramDelegate() {
  return (prisma as unknown as { program?: typeof prisma.program }).program;
}

function getProgramCourseDelegate() {
  return (prisma as unknown as { programCourse?: typeof prisma.programCourse }).programCourse;
}

function getCourseDelegate() {
  return (prisma as unknown as { course?: typeof prisma.course }).course;
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 14)}${Date.now().toString(36)}`;
}

async function ensureProgramSchema() {
  await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  CREATE TYPE "ProgramVisibility" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Program" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "programContent" TEXT,
  "sourceLanguage" TEXT NOT NULL DEFAULT 'en',
  "translations" JSONB,
  "visibility" "ProgramVisibility" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Program_code_key" ON "Program"("code");

CREATE TABLE IF NOT EXISTS "ProgramCourse" (
  "programId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  CONSTRAINT "ProgramCourse_pkey" PRIMARY KEY ("programId", "courseId")
);

CREATE INDEX IF NOT EXISTS "ProgramCourse_courseId_idx" ON "ProgramCourse"("courseId");

ALTER TABLE "Program"
ADD COLUMN IF NOT EXISTS "programContent" TEXT;

ALTER TABLE "Program"
ADD COLUMN IF NOT EXISTS "sourceLanguage" TEXT NOT NULL DEFAULT 'en';

ALTER TABLE "Program"
ADD COLUMN IF NOT EXISTS "translations" JSONB;

ALTER TABLE "Program"
ADD COLUMN IF NOT EXISTS "visibility" "ProgramVisibility" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE "Program"
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Program"
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProgramCourse_pkey'
  ) THEN
    ALTER TABLE "ProgramCourse"
    ADD CONSTRAINT "ProgramCourse_pkey" PRIMARY KEY ("programId", "courseId");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProgramCourse_programId_fkey'
  ) THEN
    ALTER TABLE "ProgramCourse"
    ADD CONSTRAINT "ProgramCourse_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "Program"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProgramCourse_courseId_fkey'
  ) THEN
    ALTER TABLE "ProgramCourse"
    ADD CONSTRAINT "ProgramCourse_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
`);
}

async function getProgramById(programId: string): Promise<ProgramRecord | null> {
  await ensureProgramSchema();
  const programDelegate = getProgramDelegate();

  if (programDelegate) {
    const found = await programDelegate.findUnique({
      where: { id: programId },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        programContent: true,
        degreeLevel: true,
        fieldOfStudy: true,
        sourceLanguage: true,
        translations: true,
        visibility: true,
        createdAt: true,
      },
    });
    return found
      ? {
          id: found.id,
          code: found.code,
          title: found.title,
          description: found.description,
          programContent: found.programContent,
          degreeLevel: found.degreeLevel ?? null,
          fieldOfStudy: found.fieldOfStudy ?? null,
          sourceLanguage: found.sourceLanguage,
          translations: found.translations as Prisma.JsonValue | null,
          visibility: found.visibility as ProgramVisibilityValue,
          createdAt: found.createdAt,
        }
      : null;
  }

  const rows = await prisma.$queryRaw<RawProgramRow[]>`
    SELECT "id", "code", "title", "description", "programContent", "degreeLevel", "fieldOfStudy", "sourceLanguage", "translations", "visibility"::text AS "visibility", "createdAt"
    FROM "Program"
    WHERE "id" = ${programId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function listProgramsWithCourses() {
  await ensureProgramSchema();
  const programDelegate = getProgramDelegate();
  const programCourseDelegate = getProgramCourseDelegate();
  const courseDelegate = getCourseDelegate();

  if (programDelegate && programCourseDelegate && courseDelegate) {
    const programs = await programDelegate.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        courses: {
          include: {
            course: {
              select: {
                id: true,
                code: true,
                title: true,
              },
            },
          },
        },
      },
    });

    const courseOptions = await courseDelegate.findMany({
      select: { id: true, code: true, title: true },
      orderBy: [{ title: "asc" }],
    });

    return {
        programs: programs.map((program) => ({
        id: program.id,
        code: program.code,
        title: program.title,
        description: program.description,
        programDetails: parseProgramContent(program.programContent),
        degreeLevel: (program as any).degreeLevel ?? null,
        fieldOfStudy: (program as any).fieldOfStudy ?? null,
        sourceLanguage: program.sourceLanguage,
        translations: program.translations,
        visibility: program.visibility as ProgramVisibilityValue,
        createdAt: program.createdAt,
        courses: program.courses.map((item) => item.course),
      })),
      courses: courseOptions,
    };
  }

  const programs = await prisma.$queryRaw<RawProgramRow[]>`
    SELECT "id", "code", "title", "description", "programContent", "degreeLevel", "fieldOfStudy", "sourceLanguage", "translations", "visibility"::text AS "visibility", "createdAt"
    FROM "Program"
    ORDER BY "createdAt" DESC
  `;
  const courses = await prisma.$queryRaw<CourseOption[]>`
    SELECT "id", "code", "title"
    FROM "Course"
    ORDER BY "title" ASC
  `;

  const programIds = programs.map((item) => item.id);
  const relations = programIds.length
    ? await prisma.$queryRaw<RawProgramCourseRow[]>`
        SELECT pc."programId", c."id", c."code", c."title"
        FROM "ProgramCourse" pc
        JOIN "Course" c ON c."id" = pc."courseId"
        WHERE pc."programId" IN (${Prisma.join(programIds)})
        ORDER BY c."title" ASC
      `
    : [];

  const relationMap = new Map<string, CourseOption[]>();
  for (const relation of relations) {
    const current = relationMap.get(relation.programId) ?? [];
    current.push({
      id: relation.id,
      code: relation.code,
      title: relation.title,
    });
    relationMap.set(relation.programId, current);
  }

  return {
    programs: programs.map((program) => ({
      id: program.id,
      code: program.code,
      title: program.title,
      description: program.description,
      programDetails: parseProgramContent(program.programContent),
      degreeLevel: (program as any).degreeLevel ?? null,
      fieldOfStudy: (program as any).fieldOfStudy ?? null,
      sourceLanguage: program.sourceLanguage,
      translations: program.translations,
      visibility: program.visibility,
      createdAt: program.createdAt,
      courses: relationMap.get(program.id) ?? [],
    })),
    courses,
  };
}

async function generateUniqueProgramCode(title: string) {
  await ensureProgramSchema();
  const programDelegate = getProgramDelegate();

  for (let nonce = 1; nonce <= 9999; nonce += 1) {
    const code = generateProgramCodeCandidate(title, nonce);

    if (programDelegate) {
      const existing = await programDelegate.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!existing) return code;
      continue;
    }

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Program" WHERE "code" = ${code} LIMIT 1
    `;
    if (!rows.length) return code;
  }

  throw new Error("Unable to generate unique program code.");
}

async function validateCourseIds(courseIds: string[]) {
  const normalized = Array.from(new Set(courseIds.map((id) => id.trim()).filter(Boolean)));
  if (!normalized.length) return { ok: true as const, ids: [] as string[] };

  const courseDelegate = getCourseDelegate();
  if (courseDelegate) {
    const courses = await courseDelegate.findMany({
      where: { id: { in: normalized } },
      select: { id: true },
    });
    if (courses.length !== normalized.length) {
      return { ok: false as const, status: 400, error: "One or more selected courses not found." };
    }
    return { ok: true as const, ids: normalized };
  }

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Course" WHERE "id" IN (${Prisma.join(normalized)})
  `;
  if (rows.length !== normalized.length) {
    return { ok: false as const, status: 400, error: "One or more selected courses not found." };
  }

  return { ok: true as const, ids: normalized };
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    if (!isSuperAdminRole(user.role)) {
      return NextResponse.json({ error: "Only Super Admin can access programs." }, { status: 403 });
    }

    const result = await listProgramsWithCourses();
    return NextResponse.json({
      programs: result.programs.map((program) => ({
        id: program.id,
        code: program.code,
        title: program.title,
        description: program.description,
        degreeLevel: (program as any).degreeLevel ?? null,
        fieldOfStudy: (program as any).fieldOfStudy ?? null,
        programDetails: program.programDetails,
        sourceLanguage: program.sourceLanguage,
        translations: program.translations,
        visibility: program.visibility,
        courseCount: program.courses.length,
        courses: program.courses,
        createdAt: program.createdAt.toISOString(),
      })),
      courses: result.courses,
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load programs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (!isSuperAdminRole(user.role)) {
      return NextResponse.json({ error: "Only Super Admin can create programs." }, { status: 403 });
    }

    const body = (await request.json()) as CreateBody;
    const normalizedProgramDetails = normalizeProgramDetailsInput(body.programDetails);
    if (!normalizedProgramDetails.ok) {
      return NextResponse.json({ error: "Invalid `programDetails` payload." }, { status: 400 });
    }
    const serializedProgramContent = serializeProgramContent(normalizedProgramDetails.value);
    const locPayload = buildProgramLocalizationPayload({
      title: body.title,
      description: body.description,
      overview: body.programDetails?.overview,
      curriculum: body.programDetails?.curriculum,
      admissionRequirements: body.programDetails?.admissionRequirements,
      careerOpportunities: body.programDetails?.careerOpportunities,
      sourceLanguage: body.sourceLanguage,
      translations: body.translations,
    });

    if ("error" in locPayload) {
      return NextResponse.json({ error: locPayload.error }, { status: 400 });
    }

    const { title, description, sourceLanguage } = locPayload.data;
    const normalizedDescription = description.trim() ? description : null;
    const visibility = parseProgramVisibility(body.visibility ?? PROGRAM_VISIBILITY_DRAFT) ?? PROGRAM_VISIBILITY_DRAFT;
    const courseIdsRaw = Array.isArray(body.courseIds) ? body.courseIds : [];

    const titleError = validateProgramTitle(title);
    if (titleError) return NextResponse.json({ error: titleError }, { status: 400 });

    const coursesValidation = await validateCourseIds(courseIdsRaw);
    if (!coursesValidation.ok) {
      return NextResponse.json({ error: coursesValidation.error }, { status: coursesValidation.status });
    }

    const code = await generateUniqueProgramCode(title);
    const programDelegate = getProgramDelegate();
    const programCourseDelegate = getProgramCourseDelegate();

    let createdId = "";

    if (programDelegate && programCourseDelegate) {
      const created = await prisma.$transaction(async (tx) => {
        const program = await tx.program.create({
          data: {
            code,
            title,
            description: normalizedDescription,
            programContent: serializedProgramContent,
            degreeLevel: body.degreeLevel ?? null,
            fieldOfStudy: body.fieldOfStudy ?? null,
            sourceLanguage,
            translations: locPayload.data.translations,
            visibility,
          },
        });

        if (coursesValidation.ids.length) {
          await tx.programCourse.createMany({
            data: coursesValidation.ids.map((courseId) => ({
              programId: program.id,
              courseId,
            })),
          });
        }

        return program;
      });
      createdId = created.id;
    } else {
      await ensureProgramSchema();
      createdId = makeId("prg");
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO "Program" ("id", "code", "title", "description", "programContent", "degreeLevel", "fieldOfStudy", "sourceLanguage", "translations", "visibility", "createdAt", "updatedAt")
          VALUES (${createdId}, ${code}, ${title}, ${normalizedDescription}, ${serializedProgramContent}, ${body.degreeLevel ?? null}, ${body.fieldOfStudy ?? null}, ${sourceLanguage}, ${JSON.stringify(locPayload.data.translations)}::jsonb, CAST(${visibility} AS "ProgramVisibility"), NOW(), NOW())
        `;

        if (coursesValidation.ids.length) {
          await tx.$executeRaw`
            INSERT INTO "ProgramCourse" ("programId", "courseId")
            VALUES ${Prisma.join(coursesValidation.ids.map((courseId) => Prisma.sql`(${createdId}, ${courseId})`))}
          `;
        }
      });
    }

    return NextResponse.json(
      {
        ok: true,
        program: {
          id: createdId,
          code,
          title,
          description: normalizedDescription,
          degreeLevel: body.degreeLevel ?? null,
          fieldOfStudy: body.fieldOfStudy ?? null,
          programDetails: normalizedProgramDetails.value,
          sourceLanguage,
          translations: locPayload.data.translations,
          visibility,
          courseCount: coursesValidation.ids.length,
          courses: coursesValidation.ids,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create program.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (!isSuperAdminRole(user.role)) {
      return NextResponse.json({ error: "Only Super Admin can update programs." }, { status: 403 });
    }

    const body = (await request.json()) as UpdateBody;
    const programId = (body.programId ?? "").trim();
    if (!programId) {
      return NextResponse.json({ error: "programId required." }, { status: 400 });
    }

    const existing = await getProgramById(programId);
    if (!existing) {
      return NextResponse.json({ error: "Program not found." }, { status: 404 });
    }

    const hasProgramDetailsInBody = body.programDetails !== undefined;
    let serializedProgramContent: string | null | undefined = undefined;
    if (hasProgramDetailsInBody) {
      const normalizedProgramDetails = normalizeProgramDetailsInput(body.programDetails);
      if (!normalizedProgramDetails.ok) {
        return NextResponse.json({ error: "Invalid `programDetails` payload." }, { status: 400 });
      }
      serializedProgramContent = serializeProgramContent(normalizedProgramDetails.value);
    }

    const locPayload = buildProgramLocalizationPayload({
      title: body.title ?? existing.title,
      description: body.description !== undefined ? body.description : existing.description,
      overview: body.programDetails?.overview,
      curriculum: body.programDetails?.curriculum,
      admissionRequirements: body.programDetails?.admissionRequirements,
      careerOpportunities: body.programDetails?.careerOpportunities,
      sourceLanguage: body.sourceLanguage ?? existing.sourceLanguage,
      translations: body.translations ?? existing.translations,
    });

    if ("error" in locPayload) {
      return NextResponse.json({ error: locPayload.error }, { status: 400 });
    }

    const { title, description, sourceLanguage } = locPayload.data;
    const normalizedDescription = description.trim() ? description : null;
    const visibility = parseProgramVisibility(body.visibility) ?? PROGRAM_VISIBILITY_DRAFT;
    const courseIdsRaw = Array.isArray(body.courseIds) ? body.courseIds : [];

    if (title !== existing.title) {
      const titleError = validateProgramTitle(title);
      if (titleError) return NextResponse.json({ error: titleError }, { status: 400 });
    }

    const coursesValidation = await validateCourseIds(courseIdsRaw);
    if (!coursesValidation.ok) {
      return NextResponse.json({ error: coursesValidation.error }, { status: coursesValidation.status });
    }

    const programDelegate = getProgramDelegate();
    const programCourseDelegate = getProgramCourseDelegate();

    if (programDelegate && programCourseDelegate) {
      const data: Prisma.ProgramUpdateInput = {
        title,
        description: normalizedDescription,
        programContent: serializedProgramContent,
        sourceLanguage,
        translations: locPayload.data.translations,
        visibility,
      };
      if (body.degreeLevel !== undefined) {
        // @ts-ignore
        data.degreeLevel = body.degreeLevel ?? null;
      }
      if (body.fieldOfStudy !== undefined) {
        // @ts-ignore
        data.fieldOfStudy = body.fieldOfStudy ?? null;
      }

      await prisma.$transaction(async (tx) => {
        await tx.programCourse.deleteMany({ where: { programId } });
        await tx.program.update({ where: { id: programId }, data });
        if (coursesValidation.ids.length) {
          await tx.programCourse.createMany({
            data: coursesValidation.ids.map((courseId) => ({
              programId,
              courseId,
            })),
          });
        }
      });
    } else {
      await ensureProgramSchema();
      const nextTitle = body.title ? title : existing.title;
      const nextDescription = body.description !== undefined ? normalizedDescription : existing.description;
      const nextVisibility = body.visibility !== undefined ? visibility : existing.visibility;
      const nextProgramContent = serializedProgramContent !== undefined ? serializedProgramContent : existing.programContent;
      const nextSourceLanguage = body.sourceLanguage !== undefined ? sourceLanguage : existing.sourceLanguage;
      const nextTranslations = body.translations !== undefined ? locPayload.data.translations : existing.translations;
      const nextDegreeLevel = body.degreeLevel !== undefined ? body.degreeLevel ?? null : existing.degreeLevel;
      const nextFieldOfStudy = body.fieldOfStudy !== undefined ? body.fieldOfStudy ?? null : existing.fieldOfStudy;

      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
            UPDATE "Program"
            SET "title" = ${nextTitle},
              "description" = ${nextDescription},
              "programContent" = ${nextProgramContent},
              "degreeLevel" = ${nextDegreeLevel},
              "fieldOfStudy" = ${nextFieldOfStudy},
              "sourceLanguage" = ${nextSourceLanguage},
              "translations" = ${JSON.stringify(nextTranslations)}::jsonb,
              "visibility" = CAST(${nextVisibility} AS "ProgramVisibility"),
              "updatedAt" = NOW()
            WHERE "id" = ${programId}
        `;

        await tx.$executeRaw`DELETE FROM "ProgramCourse" WHERE "programId" = ${programId}`;

        if (coursesValidation.ids.length) {
          await tx.$executeRaw`
            INSERT INTO "ProgramCourse" ("programId", "courseId")
            VALUES ${Prisma.join(coursesValidation.ids.map((courseId) => Prisma.sql`(${programId}, ${courseId})`))}
          `;
        }
      });
    }

    return NextResponse.json({
      ok: true,
      program: {
        id: programId,
        code: existing.code,
        title: body.title ? title : existing.title,
        description: body.description !== undefined ? normalizedDescription : existing.description,
        programDetails:
          serializedProgramContent !== undefined
            ? parseProgramContent(serializedProgramContent)
            : parseProgramContent(existing.programContent),
        degreeLevel: body.degreeLevel !== undefined ? body.degreeLevel ?? null : existing.degreeLevel ?? null,
        fieldOfStudy: body.fieldOfStudy !== undefined ? body.fieldOfStudy ?? null : existing.fieldOfStudy ?? null,
        sourceLanguage,
        translations: locPayload.data.translations,
        visibility: body.visibility !== undefined ? visibility : existing.visibility,
        courseCount: coursesValidation.ids.length,
        courses: coursesValidation.ids,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update program.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (!isSuperAdminRole(user.role)) {
      return NextResponse.json({ error: "Only Super Admin can delete programs." }, { status: 403 });
    }

    const body = (await request.json()) as DeleteBody;
    const programId = (body.programId ?? "").trim();
    if (!programId) {
      return NextResponse.json({ error: "programId required." }, { status: 400 });
    }

    const existing = await getProgramById(programId);
    if (!existing) {
      return NextResponse.json({ error: "Program not found." }, { status: 404 });
    }

    const programDelegate = getProgramDelegate();
    if (programDelegate) {
      await programDelegate.delete({ where: { id: programId } });
      return NextResponse.json({ ok: true });
    }

    await ensureProgramSchema();
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`DELETE FROM "ProgramCourse" WHERE "programId" = ${programId}`;
      await tx.$executeRaw`DELETE FROM "Program" WHERE "id" = ${programId}`;
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete program.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
