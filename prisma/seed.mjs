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

async function upsertSeedUser({ email, password, name, role }) {
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      role,
      status: UserStatus.ACTIVE,
    },
    create: {
      email,
      name,
      passwordHash,
      role,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`Seeded ${role.toLowerCase()} user: ${email}`);
}

async function main() {
  await upsertSeedUser({
    email: process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@staustin.edu",
    password: process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe123!",
    name: process.env.SEED_SUPER_ADMIN_NAME ?? "Super Admin",
    role: Role.ADMIN,
  });

  await upsertSeedUser({
    email: process.env.SEED_TEACHER_EMAIL ?? "teacher@staustin.edu",
    password: process.env.SEED_TEACHER_PASSWORD ?? "ChangeMe123!",
    name: process.env.SEED_TEACHER_NAME ?? "Seed Teacher",
    role: Role.TEACHER,
  });

  await upsertSeedUser({
    email: process.env.SEED_STUDENT_EMAIL ?? "student@staustin.edu",
    password: process.env.SEED_STUDENT_PASSWORD ?? "ChangeMe123!",
    name: process.env.SEED_STUDENT_NAME ?? "Seed Student",
    role: Role.STUDENT,
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
