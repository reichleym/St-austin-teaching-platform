import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import pkg from "pg";
const { Pool } = pkg;

// ─── DB Setup ────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function hash(password) {
  return bcrypt.hash(password, 10);
}

async function upsertUser(data) {
  const { password, ...rest } = data;
  const passwordHash = await hash(password);

  return prisma.user.upsert({
    where: { email: rest.email },
    update: { passwordHash, status: UserStatus.ACTIVE },
    create: { ...rest, passwordHash, status: UserStatus.ACTIVE },
  });
}

// ─── 1. Super Admin ───────────────────────────────────────────────────────────

async function seedSuperAdmin() {
  const admin = await upsertUser({
    email: process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@staustin.edu",
    name: process.env.SEED_SUPER_ADMIN_NAME ?? "Super Admin",
    password: process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe123!",
    role: Role.SUPER_ADMIN,
  });
  console.log(`✔ Super Admin:        ${admin.email}`);
  return admin;
}

// ─── 2. Department Head ───────────────────────────────────────────────────────

async function seedDepartmentHead() {
  const head = await upsertUser({
    email: "dept.head@staustin.edu",
    name: "Dr. Patricia Head",
    password: "DeptHead123!",
    role: Role.DEPARTMENT_HEAD,
    department: "Computer Science",
    phone: "+1-555-0200",
    country: "US",
    state: "TX",
  });
  console.log(`✔ Department Head:    ${head.email}`);
  return head;
}

// ─── 3. Teachers ─────────────────────────────────────────────────────────────

async function seedTeachers() {
  const teachers = await Promise.all([
    upsertUser({
      email: "teacher.alice@staustin.edu",
      name: "Alice Johnson",
      password: "Teacher123!",
      role: Role.TEACHER,
      department: "Computer Science",
      phone: "+1-555-0101",
      country: "US",
      state: "TX",
    }),
    upsertUser({
      email: "teacher.bob@staustin.edu",
      name: "Bob Martinez",
      password: "Teacher123!",
      role: Role.TEACHER,
      department: "Mathematics",
      phone: "+1-555-0102",
      country: "US",
      state: "CA",
    }),
  ]);
  teachers.forEach((t) => console.log(`✔ Teacher:            ${t.email}`));
  return teachers;
}

// ─── 4. Students ─────────────────────────────────────────────────────────────

async function seedStudents() {
  const students = await Promise.all([
    upsertUser({
      email: "student.charlie@staustin.edu",
      name: "Charlie Brown",
      password: "Student123!",
      role: Role.STUDENT,
      studentId: "STU-001",
      phone: "+1-555-0301",
      guardianName: "Mary Brown",
      guardianPhone: "+1-555-0300",
      country: "US",
      state: "TX",
    }),
    upsertUser({
      email: "student.diana@staustin.edu",
      name: "Diana Prince",
      password: "Student123!",
      role: Role.STUDENT,
      studentId: "STU-002",
      phone: "+1-555-0302",
      guardianName: "Zeus Prince",
      guardianPhone: "+1-555-0303",
      country: "US",
      state: "NY",
    }),
    upsertUser({
      email: "student.evan@staustin.edu",
      name: "Evan Peters",
      password: "Student123!",
      role: Role.STUDENT,
      studentId: "STU-003",
      phone: "+1-555-0304",
      country: "US",
      state: "FL",
    }),
  ]);
  students.forEach((s) => console.log(`✔ Student:            ${s.email}`));
  return students;
}

// ─── 5. System Settings ───────────────────────────────────────────────────────

async function seedSystemSettings(adminId) {
  await prisma.systemSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      studentSelfSignupEnabled: false,
      gradeScale: {
        A: { min: 90, max: 100 },
        B: { min: 80, max: 89 },
        C: { min: 70, max: 79 },
        D: { min: 60, max: 69 },
        F: { min: 0, max: 59 },
      },
      lateSubmissionPenaltyRules: {
        daysGracePeriod: 2,
        penaltyPercentPerDay: 5,
        maxPenaltyPercent: 30,
      },
      updatedById: adminId,
    },
  });
  console.log("✔ System Settings:    seeded");
}

// ─── 6. Courses ───────────────────────────────────────────────────────────────

async function seedCourses(teacherAliceId, teacherBobId) {
  const cs101 = await prisma.course.upsert({
    where: { code: "CS101" },
    update: {},
    create: {
      code: "CS101",
      title: "Introduction to Computer Science",
      description: "Foundational concepts in programming and problem solving.",
      startDate: new Date("2025-01-15"),
      endDate: new Date("2025-05-15"),
      visibility: "PUBLISHED",
      teacherId: teacherAliceId,
    },
  });

  const math201 = await prisma.course.upsert({
    where: { code: "MATH201" },
    update: {},
    create: {
      code: "MATH201",
      title: "Calculus II",
      description: "Integration techniques, sequences, and series.",
      startDate: new Date("2025-01-15"),
      endDate: new Date("2025-05-15"),
      visibility: "PUBLISHED",
      teacherId: teacherBobId,
    },
  });

  const cs102 = await prisma.course.upsert({
    where: { code: "CS102" },
    update: {},
    create: {
      code: "CS102",
      title: "Data Structures",
      description: "Arrays, linked lists, trees, graphs, and algorithms.",
      startDate: new Date("2025-06-01"),
      endDate: new Date("2025-09-30"),
      visibility: "DRAFT",
      teacherId: teacherAliceId,
    },
  });

  console.log("✔ Courses:            CS101, MATH201, CS102 (draft)");
  return { cs101, math201, cs102 };
}

// ─── 7. Programs ───────────────────────────────────────────────────────────────

async function seedPrograms(courseIds) {
  const program = await prisma.program.upsert({
    where: { code: "CSF-2025" },
    update: {},
    create: {
      code: "CSF-2025",
      title: "Computer Science Foundations",
      description: "A foundational academic program bridging introductory CS courses into a coherent pathway.",
      programContent:
        "This program includes introductory computing, data structures, and mathematical foundations relevant to early CS degrees.",
      sourceLanguage: "en",
      translations: {
        en: {
          title: "Computer Science Foundations",
          description: "A foundational academic program bridging introductory CS courses into a coherent pathway.",
          programContent:
            "This program includes introductory computing, data structures, and mathematical foundations relevant to early CS degrees.",
        },
        fr: {
          title: "Fondations en informatique",
          description:
            "Un programme fondamental qui relie les cours d'introduction à l'informatique dans un parcours cohérent.",
          programContent:
            "Ce programme comprend l'informatique introductive, les structures de données et les bases mathématiques nécessaires aux premiers cours en informatique.",
        },
      },
      visibility: "PUBLISHED",
    },
  });

  for (const courseId of courseIds) {
    await prisma.programCourse.upsert({
      where: {
        programId_courseId: {
          programId: program.id,
          courseId,
        },
      },
      update: {},
      create: {
        programId: program.id,
        courseId,
      },
    });
  }

  console.log(`✔ Program:            ${program.code} (${program.title})`);
  return program;
}

// ─── 8. Modules & Lessons ─────────────────────────────────────────────────────

async function seedModulesAndLessons(cs101Id) {
  const mod1 = await prisma.courseModule.upsert({
    where: { id: "seed-mod-1" },
    update: {},
    create: {
      id: "seed-mod-1",
      courseId: cs101Id,
      title: "Getting Started with Programming",
      description: "Setting up your environment and writing your first program.",
      position: 1,
      visibilityRule: "ALL_VISIBLE",
    },
  });

  const lesson1 = await prisma.lesson.upsert({
    where: { id: "seed-les-1" },
    update: {},
    create: {
      id: "seed-les-1",
      moduleId: mod1.id,
      title: "Installing VS Code",
      content: "Step-by-step guide to installing and configuring VS Code.",
      position: 1,
      visibility: "VISIBLE",
      isRequired: true,
    },
  });

  const lesson2 = await prisma.lesson.upsert({
    where: { id: "seed-les-2" },
    update: {},
    create: {
      id: "seed-les-2",
      moduleId: mod1.id,
      title: "Hello World in Python",
      content: "Write and run your first Python program.",
      position: 2,
      visibility: "VISIBLE",
      isRequired: true,
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    },
  });

  await prisma.lessonAttachment.upsert({
    where: { id: "seed-att-1" },
    update: {},
    create: {
      id: "seed-att-1",
      lessonId: lesson2.id,
      kind: "PDF",
      label: "Python Cheat Sheet",
      fileName: "python-cheatsheet.pdf",
      mimeType: "application/pdf",
      sizeBytes: 204800,
      publicUrl: "https://example.com/files/python-cheatsheet.pdf",
    },
  });

  const mod2 = await prisma.courseModule.upsert({
    where: { id: "seed-mod-2" },
    update: {},
    create: {
      id: "seed-mod-2",
      courseId: cs101Id,
      title: "Control Flow",
      description: "If-statements, loops, and functions.",
      position: 2,
      visibilityRule: "LIMITED_ACCESS",
      releaseAt: new Date("2025-02-01"),
    },
  });

  const lesson3 = await prisma.lesson.upsert({
    where: { id: "seed-les-3" },
    update: {},
    create: {
      id: "seed-les-3",
      moduleId: mod2.id,
      title: "If / Else Statements",
      content: "Learn how to branch code execution.",
      position: 1,
      visibility: "VISIBLE",
      isRequired: true,
    },
  });

  console.log("✔ Modules & Lessons:  2 modules, 3 lessons, 1 attachment");
  return { mod1, mod2, lesson1, lesson2, lesson3 };
}

// ─── 8. Enrollments ───────────────────────────────────────────────────────────

async function seedEnrollments(cs101Id, math201Id, studentIds) {
  const [charlieId, dianaId, evanId] = studentIds;
  const enrollments = [
    { courseId: cs101Id, studentId: charlieId },
    { courseId: cs101Id, studentId: dianaId },
    { courseId: cs101Id, studentId: evanId },
    { courseId: math201Id, studentId: charlieId },
    { courseId: math201Id, studentId: dianaId },
  ];

  for (const e of enrollments) {
    await prisma.enrollment.upsert({
      where: { courseId_studentId: e },
      update: {},
      create: { ...e, status: "ACTIVE" },
    });
  }
  console.log(`✔ Enrollments:        ${enrollments.length} created`);
}

// ─── 9. Assignments & Grades ──────────────────────────────────────────────────

async function seedAssignmentsAndGrades(cs101Id, teacherAliceId, studentIds) {
  const [charlieId, dianaId, evanId] = studentIds;

  const hw1 = await prisma.assignment.upsert({
    where: { id: "seed-assign-1" },
    update: {},
    create: {
      id: "seed-assign-1",
      courseId: cs101Id,
      title: "Homework 1: Variables & Types",
      description: "Complete all exercises in Chapter 1.",
      dueAt: new Date("2025-02-10"),
      maxPoints: 100,
    },
  });

  await prisma.assignment.upsert({
    where: { id: "seed-assign-2" },
    update: {},
    create: {
      id: "seed-assign-2",
      courseId: cs101Id,
      title: "Homework 2: Loops",
      description: "Implement 5 loop-based problems.",
      dueAt: new Date("2025-02-24"),
      maxPoints: 100,
    },
  });

  const gradePairs = [
    { studentId: charlieId, points: 92 },
    { studentId: dianaId, points: 87 },
    { studentId: evanId, points: 74 },
  ];

  for (const g of gradePairs) {
    await prisma.grade.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId: hw1.id,
          studentId: g.studentId,
        },
      },
      update: {},
      create: {
        assignmentId: hw1.id,
        studentId: g.studentId,
        awardedById: teacherAliceId,
        points: g.points,
        publishedAt: new Date("2025-02-12"),
      },
    });
  }

  await prisma.gradeEditRequest.upsert({
    where: { id: "seed-grade-edit-1" },
    update: {},
    create: {
      id: "seed-grade-edit-1",
      assignmentId: hw1.id,
      studentId: charlieId,
      requestedById: charlieId,
      reason: "I believe my answer for question 3 deserves full credit.",
      proposedPoints: 97,
      status: "PENDING",
    },
  });

  console.log("✔ Assignments:        HW1, HW2");
  console.log("✔ Grades:             3 grades for HW1");
  console.log("✔ Grade Edit Request: 1 pending");
}

// ─── 10. Lesson Completions ───────────────────────────────────────────────────

async function seedLessonCompletions(lesson1Id, lesson2Id, studentIds) {
  const [charlieId, dianaId] = studentIds;
  const completions = [
    { lessonId: lesson1Id, studentId: charlieId },
    { lessonId: lesson2Id, studentId: charlieId },
    { lessonId: lesson1Id, studentId: dianaId },
  ];

  for (const c of completions) {
    await prisma.lessonCompletion.upsert({
      where: { lessonId_studentId: c },
      update: {},
      create: c,
    });
  }
  console.log(`✔ Lesson Completions: ${completions.length} records`);
}

// ─── 11. Discussions ─────────────────────────────────────────────────────────

async function seedDiscussions(cs101Id, studentIds) {
  const [charlieId, dianaId] = studentIds;

  const disc = await prisma.discussion.upsert({
    where: { id: "seed-disc-1" },
    update: {},
    create: {
      id: "seed-disc-1",
      courseId: cs101Id,
      title: "Week 1 Introductions",
      content: "Introduce yourself to the class!",
      isClosed: false,
    },
  });

  for (const studentId of [charlieId, dianaId]) {
    await prisma.discussionParticipation.upsert({
      where: {
        discussionId_studentId: { discussionId: disc.id, studentId },
      },
      update: {},
      create: {
        discussionId: disc.id,
        studentId,
        postsCount: 1,
        completionRate: 100,
        lastPostedAt: new Date(),
      },
    });
  }
  console.log("✔ Discussions:        1 discussion, 2 participations");
}

// ─── 12. Announcements ───────────────────────────────────────────────────────

async function seedAnnouncements(adminId) {
  await prisma.announcement.upsert({
    where: { id: "seed-ann-global-1" },
    update: {},
    create: {
      id: "seed-ann-global-1",
      title: "Welcome to the New Semester!",
      content:
        "We are excited to kick off the Spring 2025 semester. Please review your course materials.",
      sourceLanguage: "en",
      translations: {
        en: {
          title: "Welcome to the New Semester!",
          content:
            "We are excited to kick off the Spring 2025 semester. Please review your course materials.",
        },
        fr: {
          title: "Bienvenue pour le nouveau semestre !",
          content:
            "Nous sommes ravis de lancer le semestre du printemps 2025. Veuillez consulter vos supports de cours.",
        },
      },
      isGlobal: true,
      audience: "BOTH",
      expiresAt: new Date("2025-02-01"),
      createdById: adminId,
    },
  });

  await prisma.announcement.upsert({
    where: { id: "seed-ann-global-2" },
    update: {},
    create: {
      id: "seed-ann-global-2",
      title: "System Maintenance – Saturday",
      content:
        "The platform will be offline for maintenance from 2–4 AM Saturday.",
      sourceLanguage: "en",
      translations: {
        en: {
          title: "System Maintenance – Saturday",
          content: "The platform will be offline for maintenance from 2–4 AM Saturday.",
        },
        fr: {
          title: "Maintenance du système - Samedi",
          content: "La plateforme sera indisponible pour maintenance samedi de 2 h à 4 h.",
        },
      },
      isGlobal: true,
      audience: "BOTH",
      createdById: adminId,
    },
  });

  console.log("✔ Announcements:      2 global");
}

// ─── 13. Instruction Threads ──────────────────────────────────────────────────

async function seedInstructionThreads(
  cs101Id,
  mod1Id,
  charlieId,
  dianaId,
  teacherAliceId
) {
  // Thread 1: public, answered, pinned
  const thread1 = await prisma.instructionThread.upsert({
    where: { id: "seed-thread-1" },
    update: {},
    create: {
      id: "seed-thread-1",
      studentId: charlieId,
      courseId: cs101Id,
      moduleId: mod1Id,
      subject: "Error running Hello World",
      status: "ANSWERED",
      isPinned: true,
      isPrivate: false,
    },
  });

  // Root message from student
  await prisma.instructionMessage.upsert({
    where: { id: "seed-msg-1" },
    update: {},
    create: {
      id: "seed-msg-1",
      threadId: thread1.id,
      parentId: null,
      authorId: charlieId,
      body: "I get a SyntaxError when I run the Hello World script. What am I doing wrong?",
      isTeacherReply: false,
    },
  });

  // Teacher reply nested under root message
  await prisma.instructionMessage.upsert({
    where: { id: "seed-msg-2" },
    update: {},
    create: {
      id: "seed-msg-2",
      threadId: thread1.id,
      parentId: "seed-msg-1",
      authorId: teacherAliceId,
      body: "Make sure you are using Python 3 and that you saved the file with a .py extension. Also check your indentation!",
      isTeacherReply: true,
    },
  });

  // Student follow-up nested under teacher reply
  await prisma.instructionMessage.upsert({
    where: { id: "seed-msg-2b" },
    update: {},
    create: {
      id: "seed-msg-2b",
      threadId: thread1.id,
      parentId: "seed-msg-2",
      authorId: charlieId,
      body: "That fixed it, thank you!",
      isTeacherReply: false,
    },
  });

  // Thread 2: private, open
  const thread2 = await prisma.instructionThread.upsert({
    where: { id: "seed-thread-2" },
    update: {},
    create: {
      id: "seed-thread-2",
      studentId: dianaId,
      courseId: cs101Id,
      moduleId: mod1Id,
      subject: "When will Module 2 be available?",
      status: "OPEN",
      isPinned: false,
      isPrivate: true,
    },
  });

  await prisma.instructionMessage.upsert({
    where: { id: "seed-msg-3" },
    update: {},
    create: {
      id: "seed-msg-3",
      threadId: thread2.id,
      parentId: null,
      authorId: dianaId,
      body: "Hi, I finished Module 1. When can I access Module 2?",
      isTeacherReply: false,
    },
  });

  console.log("✔ Instruction Threads: 2 threads, 4 messages (nested reply demo)");
}

// ─── 14. Invitations ─────────────────────────────────────────────────────────

async function seedInvitations(adminId) {
  await prisma.invitation.upsert({
    where: { token: "seed-invite-token-teacher-001" },
    update: {},
    create: {
      email: "pending.teacher@staustin.edu",
      name: "Future Teacher",
      role: Role.TEACHER,
      department: "Physics",
      token: "seed-invite-token-teacher-001",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdById: adminId,
    },
  });

  await prisma.invitation.upsert({
    where: { token: "seed-invite-token-student-001" },
    update: {},
    create: {
      email: "pending.student@staustin.edu",
      name: "Future Student",
      role: Role.STUDENT,
      studentId: "STU-099",
      guardianName: "Parent Name",
      guardianPhone: "+1-555-9999",
      token: "seed-invite-token-student-001",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdById: adminId,
    },
  });

  console.log("✔ Invitations:        1 pending teacher, 1 pending student");
}

// ─── 15. Admin Action Logs ────────────────────────────────────────────────────

async function seedAdminLogs(adminId) {
  const logs = [
    {
      id: "seed-log-1",
      action: "INVITE_TEACHER",
      actorId: adminId,
      entityType: "Invitation",
      metadata: { email: "teacher.alice@staustin.edu" },
    },
    {
      id: "seed-log-2",
      action: "INVITE_STUDENT",
      actorId: adminId,
      entityType: "Invitation",
      metadata: { email: "student.charlie@staustin.edu" },
    },
    {
      id: "seed-log-3",
      action: "UPDATE_SYSTEM_SETTINGS",
      actorId: adminId,
      metadata: { field: "gradeScale", note: "Initial configuration" },
    },
  ];

  for (const log of logs) {
    await prisma.adminActionLog.upsert({
      where: { id: log.id },
      update: {},
      create: log,
    });
  }
  console.log(`✔ Admin Logs:         ${logs.length} entries`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🌱 Starting full seed...\n");

  const admin = await seedSuperAdmin();
  await seedDepartmentHead();
  const [teacherAlice, teacherBob] = await seedTeachers();
  const [charlie, diana, evan] = await seedStudents();

  await seedSystemSettings(admin.id);

  const { cs101, math201 } = await seedCourses(teacherAlice.id, teacherBob.id);
  await seedPrograms([cs101.id, math201.id]);
  const { mod1, lesson1, lesson2 } = await seedModulesAndLessons(cs101.id);

  await seedEnrollments(cs101.id, math201.id, [charlie.id, diana.id, evan.id]);
  await seedAssignmentsAndGrades(cs101.id, teacherAlice.id, [
    charlie.id,
    diana.id,
    evan.id,
  ]);
  await seedLessonCompletions(lesson1.id, lesson2.id, [charlie.id, diana.id]);
  await seedDiscussions(cs101.id, [charlie.id, diana.id]);
  await seedAnnouncements(admin.id);
  await seedInstructionThreads(
    cs101.id,
    mod1.id,
    charlie.id,
    diana.id,
    teacherAlice.id
  );
  await seedInvitations(admin.id);
  await seedAdminLogs(admin.id);

  console.log("\n✅ Seed complete!\n");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("  Role             Email                           Password");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`  SUPER_ADMIN      ${process.env.SEED_SUPER_ADMIN_EMAIL ? process.env.SEED_SUPER_ADMIN_EMAIL : "admin@staustin.edu"}   ${process.env.SEED_SUPER_ADMIN_PASSWORD ? process.env.SEED_SUPER_ADMIN_PASSWORD : "ChangeMe123!"}`);
  console.log(`  DEPT_HEAD        dept.head@staustin.edu          DeptHead123!`);
  console.log(`  TEACHER          teacher.alice@staustin.edu      Teacher123!`);
  console.log(`  TEACHER          teacher.bob@staustin.edu        Teacher123!`);
  console.log(`  STUDENT          student.charlie@staustin.edu    Student123!`);
  console.log(`  STUDENT          student.diana@staustin.edu      Student123!`);
  console.log(`  STUDENT          student.evan@staustin.edu       Student123!`);
  console.log("─────────────────────────────────────────────────────────────\n");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
