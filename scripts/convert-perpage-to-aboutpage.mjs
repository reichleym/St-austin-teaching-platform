#!/usr/bin/env node
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function convert(slug, pageTable, sectionDelegateName) {
  console.log(`\nConverting ${slug} (${pageTable}) -> AboutPage`);

  // ensure dynamic page exists
  const pageRow = await prisma.dynamicPage.findUnique({ where: { slug } });
  let dynamicPageId = pageRow?.id;
  if (!dynamicPageId) {
    const source = await prisma[pageTable].findFirst({ where: { slug } });
    const created = await prisma.dynamicPage.create({ data: { slug, title: source?.name ?? slug, published: true } });
    dynamicPageId = created.id;
    console.log(`  Created DynamicPage id=${dynamicPageId}`);
  } else {
    console.log(`  DynamicPage exists id=${dynamicPageId}`);
  }

  // read per-page section rows
  const rows = await (prisma as any)[sectionDelegateName].findMany({ where: { pageId: dynamicPageId } });
  if (!rows || rows.length === 0) {
    // As a fallback, also try reading sections that reference the old page id (from page table)
    const source = await prisma[pageTable].findUnique({ where: { slug } });
    if (source) {
      const altRows = await (prisma as any)[sectionDelegateName].findMany({ where: { pageId: source.id }, orderBy: { position: 'asc' } });
      if (altRows && altRows.length > 0) {
        console.log(`  Found ${altRows.length} legacy section rows referencing ${pageTable}.${source.id}`);
        for (const r of altRows) {
          await prisma.aboutPage.create({ data: { pageId: dynamicPageId, sectionKey: r.sectionKey, componentType: r.componentType, position: r.position, content: r.content } });
        }
        console.log(`  Migrated ${altRows.length} rows into AboutPage for ${slug}`);
        return;
      }
    }
    console.log('  No per-page sections found to migrate.');
    return;
  }

  console.log(`  Migrating ${rows.length} rows`);
  for (const r of rows) {
    await prisma.aboutPage.create({ data: { pageId: dynamicPageId, sectionKey: r.sectionKey, componentType: r.componentType, position: r.position, content: r.content } });
  }
  console.log(`  Migrated ${rows.length} rows into AboutPage for ${slug}`);
}

async function main() {
  try {
    await convert('admissions', 'admissionsPage', 'admissionsSection');
    await convert('donations', 'donationsPage', 'donationsSection');
    await convert('tuition', 'tuitionPage', 'tuitionSection');
    await convert('government-employees', 'governmentEmployeesPage', 'governmentEmployeesSection');
    console.log('\nConversion complete.');
  } catch (err) {
    console.error('Conversion failed', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
