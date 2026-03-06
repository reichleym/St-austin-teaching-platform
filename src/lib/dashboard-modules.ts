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
    roles: ["TEACHER", "STUDENT"],
  },
  {
    slug: "engagement",
    title: "Engagement",
    description: "Discussions and classroom interaction management.",
    roles: ["DEPARTMENT_HEAD", "TEACHER", "STUDENT"],
  },
  {
    slug: "announcements-feed",
    title: "Announcements",
    description: "Read institution announcements and updates.",
    roles: ["DEPARTMENT_HEAD", "TEACHER", "STUDENT"],
  },
  {
    slug: "assessment",
    title: "Assessment",
    description: "Assignments, grading, and performance evaluation.",
    roles: ["SUPER_ADMIN", "DEPARTMENT_HEAD", "TEACHER", "STUDENT"],
  },
  {
    slug: "oversight",
    title: "Oversight",
    description: "Department head course oversight and teacher follow-ups.",
    roles: ["SUPER_ADMIN", "DEPARTMENT_HEAD"],
  },
  {
    slug: "messages",
    title: "Messages",
    description: "View reminders and comments from department heads.",
    roles: ["TEACHER"],
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
