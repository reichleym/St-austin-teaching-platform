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
    roles: [Role.SUPER_ADMIN, Role.TEACHER, Role.STUDENT],
  },
  {
    slug: "user-access",
    title: "User & Access",
    description: "User lifecycle, invites, and access policy controls.",
    roles: [Role.SUPER_ADMIN],
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
  },
  {
    slug: "system-settings",
    title: "Policies & Settings",
    description: "Platform governance and administrator configuration.",
    roles: [Role.SUPER_ADMIN],
  },
  {
    slug: "admin-profile",
    title: "Admin Profile",
    description: "Manage your Super Admin profile information.",
    roles: [Role.SUPER_ADMIN],
    parentSlug: "system-settings",
  },
  {
    slug: "academic-policies",
    title: "Academic Policies",
    description: "Manage grade scale and late submission penalty rules.",
    roles: [Role.SUPER_ADMIN],
    parentSlug: "system-settings",
  },
  {
    slug: "invitations",
    title: "Invitations",
    description: "Invite teachers and students.",
    roles: [Role.SUPER_ADMIN],
    href: "/dashboard/admin/invitations",
    parentSlug: "user-access",
  },
];
