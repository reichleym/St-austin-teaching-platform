import { Role } from "@prisma/client";

export type DashboardModule = {
  slug: string;
  title: string;
  description: string;
  roles: Role[];
};

export const dashboardModules: DashboardModule[] = [
  {
    slug: "overview",
    title: "Overview",
    description: "Role-based operational summary and quick entry points.",
    roles: [Role.ADMIN, Role.TEACHER, Role.STUDENT],
  },
  {
    slug: "courses",
    title: "Courses",
    description: "Manage and navigate academic course structures.",
    roles: [Role.ADMIN, Role.TEACHER, Role.STUDENT],
  },
  {
    slug: "learning",
    title: "Learning",
    description: "Track content delivery, progress, and learning plans.",
    roles: [Role.ADMIN, Role.TEACHER, Role.STUDENT],
  },
  {
    slug: "engagement",
    title: "Engagement",
    description: "Discussions and classroom interaction management.",
    roles: [Role.ADMIN, Role.TEACHER, Role.STUDENT],
  },
  {
    slug: "assessment",
    title: "Assessment",
    description: "Assignments, grading, and performance evaluation.",
    roles: [Role.ADMIN, Role.TEACHER, Role.STUDENT],
  },
  {
    slug: "admin-controls",
    title: "Admin",
    description: "Identity, roles, and administrative control center.",
    roles: [Role.ADMIN],
  },
];
