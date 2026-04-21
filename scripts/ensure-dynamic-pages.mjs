#!/usr/bin/env node
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function ensure() {
  const client = await pool.connect();
  try {
    // For each legacy page table, insert a DynamicPage row with the same id if missing.
    const pages = [
      { table: 'DonationsPage', slug: 'donations' },
      { table: 'AdmissionsPage', slug: 'admissions' },
      { table: 'TuitionPage', slug: 'tuition' },
      { table: 'GovernmentEmployeesPage', slug: 'government-employees' },
    ];

    for (const p of pages) {
      const res = await client.query(`SELECT id, slug, name, "createdAt", "updatedAt" FROM "${p.table}" LIMIT 1`);
      if (res.rows.length === 0) {
        console.log(`No row found in ${p.table}; skipping`);
        continue;
      }
      const row = res.rows[0];
      const exists = await client.query('SELECT 1 FROM "DynamicPage" WHERE id = $1', [row.id]);
      if (exists.rows.length > 0) {
        console.log(`DynamicPage for ${p.slug} already exists (id=${row.id})`);
        continue;
      }
      await client.query(
        `INSERT INTO "DynamicPage" (id, slug, title, published, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6)`,
        [row.id, p.slug, row.name || p.slug, true, row.createdat || new Date(), row.updatedat || new Date()]
      );
      console.log(`Inserted DynamicPage for ${p.slug} (id=${row.id})`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

ensure().catch((err) => {
  console.error('Failed to ensure dynamic pages', err);
  process.exitCode = 1;
});
