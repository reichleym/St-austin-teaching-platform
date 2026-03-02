import { Role } from "@prisma/client";

export type DashboardModule = {
  slug: string;
  title: string;
  description: string;
  roles: Role[];
  href?: string;
  parentSlug?: string;
};

export const dashboardModules: DashboardModule[] = [
  {
    slug: "overview",
    title: "Overview",
    description: "Role-tailored executive dashboard.",
    roles: [Role.SUPER_ADMIN, Role.TEACHER, Role.STUDENT],
  },
  {
    slug: "courses",
    title: "Courses",
    description: "Manage and navigate academic course structures.",
    roles: [Role.SUPER_ADMIN, Role.TEACHER, Role.STUDENT],
  },
  {
    slug: "learning",
    title: "Learning",
    description: "Track content delivery, progress, and learning plans.",
    roles: [Role.TEACHER, Role.STUDENT],
  },
  {
    slug: "engagement",
    title: "Engagement",
    description: "Discussions and classroom interaction management.",
    roles: [Role.TEACHER, Role.STUDENT],
  },
  {
    slug: "announcements-feed",
    title: "Announcements",
    description: "Read institution announcements and updates.",
    roles: [Role.TEACHER, Role.STUDENT],
  },
  {
    slug: "assessment",
    title: "Assessment",
    description: "Assignments, grading, and performance evaluation.",
    roles: [Role.TEACHER, Role.STUDENT],
  },
  {
    slug: "admin-controls",
    title: "Super Admin",
    description: "Institution governance and platform controls.",
    roles: [Role.SUPER_ADMIN],
  },
  {
    slug: "user-access",
    title: "User & Access",
    description: "User lifecycle, invites, and access policy controls.",
    roles: [Role.SUPER_ADMIN],
    parentSlug: "admin-controls",
  },
  {
    slug: "view-teachers",
    title: "All Teachers",
    description: "View and add new Teachers",
    roles: [Role.SUPER_ADMIN],
    parentSlug: "user-access",
  },
  {
    slug: "view-students",
    title: "All Students",
    description: "View and add new students",
    roles: [Role.SUPER_ADMIN],
    parentSlug: "user-access",
  },
  {
    slug: "announcements",
    title: "Announcements",
    description: "Global announcements lifecycle and visibility controls.",
    roles: [Role.SUPER_ADMIN],
    parentSlug: "admin-controls",
  },
  {
    slug: "academic-oversight",
    title: "Academic Oversight",
    description: "Read-only cross-course monitoring and approvals.",
    roles: [Role.SUPER_ADMIN],
    parentSlug: "admin-controls",
  },
  {
    slug: "system-settings",
    title: "System Settings",
    description: "Grade scales, penalties, and signup policy controls.",
    roles: [Role.SUPER_ADMIN],
    parentSlug: "admin-controls",
  },
  {
    slug: "invitations",
    title: "Invitations",
    description: "Invite teachers and students.",
    roles: [Role.SUPER_ADMIN],
    href: "/dashboard/admin/invitations",
    parentSlug: "admin-controls",
  },
];
