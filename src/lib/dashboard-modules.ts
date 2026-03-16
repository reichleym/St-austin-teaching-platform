export type DashboardRole = "SUPER_ADMIN" | "ADMIN" | "DEPARTMENT_HEAD" | "TEACHER" | "STUDENT";

export type DashboardModule = {
  slug: string;
  title: string;
  description: string;
  roles: DashboardRole[];
  href?: string;
  parentSlug?: string;
};

export const dashboardModules: DashboardModule[] = [
  {
    slug: "overview",
    title: "Overview",
    description: "Role-tailored executive dashboard.",
    roles: ["SUPER_ADMIN", "DEPARTMENT_HEAD", "TEACHER", "STUDENT"],
  },
  {
    slug: "courses",
    title: "Courses",
    description: "Manage and navigate academic course structures.",
    roles: ["SUPER_ADMIN", "DEPARTMENT_HEAD", "TEACHER", "STUDENT"],
  },
  {
    slug: "learning",
    title: "Learning",
    description: "Track content delivery, progress, and learning plans.",
    roles: ["STUDENT"],
  },
  {
    slug: "progress",
    title: "Student Progress",
    description: "Monitor course completion and lesson progress.",
    roles: ["SUPER_ADMIN", "STUDENT"],
  },
  {
    slug: "engagement",
    title: "Discussion Board",
    description: "Discussion boards and classroom interaction management.",
    roles: ["DEPARTMENT_HEAD", "TEACHER", "STUDENT"],
  },
  {
    slug: "instructions",
    title: "Ask My Teacher",
    description: "Post questions to your teacher and get answers.",
    roles: ["STUDENT"] as DashboardRole[],
  },

  // For TEACHERS — shows inbox across all their courses
  {
    slug: "instructions",
    title: "Student Questions",
    description: "View and reply to student questions.",
    roles: ["TEACHER", "DEPARTMENT_HEAD"] as DashboardRole[],
  },
  {
    slug: "announcements-feed",
    title: "Announcements",
    description: "Read institution announcements and updates.",
    roles: ["DEPARTMENT_HEAD", "TEACHER", "STUDENT"],
  },
  {
    slug: "assessment",
    title: "Assignments",
    description: "Assignments, grading, and performance evaluation.",
    roles: ["SUPER_ADMIN", "DEPARTMENT_HEAD", "TEACHER", "STUDENT"],
  },
  {
    slug: "user-access",
    title: "User & Access",
    description: "User lifecycle, invites, and access policy controls.",
    roles: ["SUPER_ADMIN"],
  },
  {
    slug: "view-teachers",
    title: "All Teachers",
    description: "View and add new Teachers",
    roles: ["SUPER_ADMIN"],
    parentSlug: "user-access",
  },
  {
    slug: "view-students",
    title: "All Students",
    description: "View and add new students",
    roles: ["SUPER_ADMIN"],
    parentSlug: "user-access",
  },
  {
    slug: "view-department-heads",
    title: "All Department Heads",
    description: "View and add department heads",
    roles: ["SUPER_ADMIN"],
    parentSlug: "user-access",
  },
  {
    slug: "announcements",
    title: "Announcements",
    description: "Global announcements lifecycle and visibility controls.",
    roles: ["SUPER_ADMIN"],
  },
  {
    slug: "system-settings",
    title: "Policies & Settings",
    description: "Platform governance and administrator configuration.",
    roles: ["SUPER_ADMIN"],
  },
  {
    slug: "admin-profile",
    title: "Admin Profile",
    description: "Manage your Super Admin profile information.",
    roles: ["SUPER_ADMIN"],
    parentSlug: "system-settings",
  },
  {
    slug: "academic-policies",
    title: "Academic Policies",
    description: "Manage grade scale and late submission penalty rules.",
    roles: ["SUPER_ADMIN"],
    parentSlug: "system-settings",
  },
  {
    slug: "invitations",
    title: "Invitations",
    description: "Invite teachers and students.",
    roles: ["SUPER_ADMIN"],
    href: "/dashboard/admin/invitations",
    parentSlug: "user-access",
  },
];
