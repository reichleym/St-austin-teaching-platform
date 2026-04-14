export const universityCareerRoles = ["SUPER_ADMIN"] as const;
export type UniversityCareerRole = (typeof universityCareerRoles)[number];

export type UniversityCareer = {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
};

const idPattern = /^[a-zA-Z0-9_-]{4,20}$/;
const titleMaxLength = 100;
const descriptionMaxLength = 500;

function createCareerId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().slice(0, 20);
  }
  return `cr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function createNewCareer(): UniversityCareer {
  return {
    id: createCareerId(),
    title: "",
    description: "",
    isActive: true,
  };
}

function normalizeCareer(input: unknown): UniversityCareer | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  
  const record = input as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const description = typeof record.description === "string" ? record.description.trim() : "";
  const isActive = record.isActive === true;

  if (!id || !idPattern.test(id) || !title || title.length > titleMaxLength || 
      description.length > descriptionMaxLength) {
    return null;
  }

  return { id, title, description, isActive };
}

export function normalizeUniversityCareers(input: unknown): UniversityCareer[] {
  if (!Array.isArray(input)) return [];

  const validCareers: UniversityCareer[] = [];
  for (let i = 0; i < input.length; i++) {
    const career = normalizeCareer(input[i]);
    if (career) validCareers.push(career);
  }

  // Remove duplicates by ID
  const unique = new Map<string, UniversityCareer>();
  for (const career of validCareers) {
    unique.set(career.id, career);
  }

  return Array.from(unique.values()).sort((a, b) => a.title.localeCompare(b.title));
}

export { createNewCareer };

