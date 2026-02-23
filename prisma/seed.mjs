import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function createInitialSuperAdmin({ email, password, name }) {
  const passwordHash = await bcrypt.hash(password, 10);

  const existingAdmins = await prisma.user.findMany({
    where: { role: Role.SUPER_ADMIN },
    select: { id: true, email: true },
  });

  if (existingAdmins.length > 0) {
    if (existingAdmins.length === 1 && existingAdmins[0].email === email) {
      console.log(`Super Admin already bootstrapped: ${email}`);
      return;
    }

    const existingEmails = existingAdmins.map((admin) => admin.email).join(", ");
    throw new Error(
      `Bootstrap blocked: admin account(s) already exist (${existingEmails}). ` +
        "Create or manage admins manually in the database."
    );
  }

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`Created initial Super Admin: ${email}`);
}

async function main() {
  await createInitialSuperAdmin({
    email: process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@staustin.edu",
    password: process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe123!",
    name: process.env.SEED_SUPER_ADMIN_NAME ?? "Super Admin",
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
