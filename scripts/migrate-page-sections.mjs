#!/usr/bin/env node
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function migratePage(pageModelName, pageFindMany, sectionCreateMany) {
  console.log(`\nMigrating sections for ${pageModelName}...`);
  const pages = await pageFindMany();
  for (const page of pages) {
    const raw = page.sections;
    let sections = [];
    if (Array.isArray(raw)) sections = raw;
    else if (typeof raw === 'string' && raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) sections = parsed;
      } catch (e) {
        console.warn(`  Skipping page ${page.slug}: failed to parse sections JSON`);
        continue;
      }
    }

    if (!sections || sections.length === 0) {
      console.log(`  No sections for page ${page.slug}`);
      continue;
    }

    // delete existing sections to avoid duplicates
    await prisma[sectionCreateMany.modelName].deleteMany({ where: { pageId: page.id } }).catch(() => null);

    const data = sections.map((s, idx) => ({
      pageId: page.id,
      sectionKey: typeof s.sectionKey === 'string' ? s.sectionKey : `section-${idx}`,
      componentType: typeof s.componentType === 'string' ? s.componentType : (s.component || 'Unknown'),
      position: typeof s.position === 'number' ? s.position : idx,
      content: s.content ?? s,
    }));

    // use createMany for speed, fallback to create if not supported
    try {
      await prisma[sectionCreateMany.modelName].createMany({ data });
      console.log(`  Migrated ${data.length} sections for page ${page.slug}`);
    } catch (err) {
      console.log('  createMany failed, falling back to individual creates');
      for (const row of data) {
        await prisma[sectionCreateMany.modelName].create({ data: row });
      }
      console.log(`  Migrated ${data.length} sections for page ${page.slug}`);
    }
  }
}

async function main() {
  try {
    await migratePage(
      'admissions',
      () => prisma.admissionsPage.findMany(),
      { modelName: 'admissionsSection' }
    );

    await migratePage(
      'donations',
      () => prisma.donationsPage.findMany(),
      { modelName: 'donationsSection' }
    );

    await migratePage(
      'tuition',
      () => prisma.tuitionPage.findMany(),
      { modelName: 'tuitionSection' }
    );

    await migratePage(
      'government-employees',
      () => prisma.governmentEmployeesPage.findMany(),
      { modelName: 'governmentEmployeesSection' }
    );

    console.log('\nMigration complete.');
  } catch (err) {
    console.error('Migration failed', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
