const { spawnSync } = require("child_process");

// This helper runs prisma migrations and seed during production builds
// Only runs when RUN_PROD_MIGRATIONS is set to '1' or 'true'.
// Usage: set RUN_PROD_MIGRATIONS=1 in your Vercel/production environment.

function envTrue(name) {
  const v = process.env[name];
  return v === "1" || String(v).toLowerCase() === "true";
}

if (!envTrue("RUN_PROD_MIGRATIONS")) {
  console.log("Skipping production migrations (RUN_PROD_MIGRATIONS not set)");
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set — cannot run migrations.");
  process.exit(1);
}

console.log("RUN_PROD_MIGRATIONS set — running Prisma migrations (deploy)...");

const deploy = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });
if (deploy.status !== 0) {
  console.error("prisma migrate deploy failed");
  process.exit(deploy.status || 1);
}

console.log("Migrations deployed. Running seed (if configured)...");

const seed = spawnSync("npx", ["prisma", "db", "seed"], { stdio: "inherit" });
if (seed.status !== 0) {
  console.error("prisma db seed failed (continuing)");
  // don't fail the build just because seed failed
} else {
  console.log("Seed completed.");
}

console.log("Production migration helper finished.");
