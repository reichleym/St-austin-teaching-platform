import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pkg from 'pg';
import fs from 'fs';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = `/tmp/st_austin_prod_json_backup_${timestamp}.json`;
  try {
    const [dynamicPages, aboutPages, studentExperiences] = await Promise.all([
      prisma.dynamicPage.findMany({}),
      prisma.aboutPage.findMany({}),
      prisma.studentExperience.findMany({}),
    ]);

    const payload = { dynamicPages, aboutPages, studentExperiences, createdAt: new Date().toISOString() };
    fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`BACKUP_CREATED:${outFile}`);
  } catch (err) {
    console.error('BACKUP_FAILED', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

backup();
