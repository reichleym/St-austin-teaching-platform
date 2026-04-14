export const dashboardCalendarRoles = ["SUPER_ADMIN", "DEPARTMENT_HEAD", "TEACHER", "STUDENT"] as const;

export type DashboardCalendarRole = (typeof dashboardCalendarRoles)[number];

export type DashboardCalendarEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string | null;
  roles: DashboardCalendarRole[];
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;

function normalizeRole(value: unknown): DashboardCalendarRole | null {
  if (typeof value !== "string") return null;
  const role = value.trim().toUpperCase();
  if (dashboardCalendarRoles.includes(role as DashboardCalendarRole)) {
    return role as DashboardCalendarRole;
  }
  return null;
}

function normalizeTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!timePattern.test(normalized)) return null;
  const [hourPart, minutePart] = normalized.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return normalized;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!datePattern.test(normalized)) return null;
  return normalized;
}

function normalizeRoles(value: unknown): DashboardCalendarRole[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<DashboardCalendarRole>();
  for (const item of value) {
    const role = normalizeRole(item);
    if (role) unique.add(role);
  }
  return Array.from(unique);
}

function compareEvents(a: DashboardCalendarEvent, b: DashboardCalendarEvent) {
  const dateCompare = a.date.localeCompare(b.date);
  if (dateCompare !== 0) return dateCompare;
  const startCompare = a.startTime.localeCompare(b.startTime);
  if (startCompare !== 0) return startCompare;
  return a.title.localeCompare(b.title);
}

export function normalizeDashboardCalendarEvents(input: unknown): DashboardCalendarEvent[] {
  if (!Array.isArray(input)) return [];

  const output: DashboardCalendarEvent[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const item = input[index];
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const date = normalizeDate(record.date);
    const startTime = normalizeTime(record.startTime);
    const endTime = normalizeTime(record.endTime);
    const roles = normalizeRoles(record.roles);

    if (!title || !date || !startTime || roles.length === 0) continue;

    const id =
      typeof record.id === "string" && record.id.trim().length > 0
        ? record.id.trim()
        : `${date}-${startTime}-${title.toLowerCase().replace(/\s+/g, "-")}-${index}`;

    output.push({
      id,
      title,
      date,
      startTime,
      endTime,
      roles,
    });
  }

  return output.sort(compareEvents);
}

export function getLocalDateString(date = new Date()) {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

function mapRole(role: string): DashboardCalendarRole | null {
  const normalized = role.trim().toUpperCase();
  if (normalized === "ADMIN") return "SUPER_ADMIN";
  return normalizeRole(normalized);
}

export function toTimelineLabel(event: DashboardCalendarEvent) {
  const timeLabel = event.endTime ? `${event.startTime}-${event.endTime}` : event.startTime;
  return `${timeLabel} ${event.title}`;
}

export function getTodayTimelineEntries(
  events: DashboardCalendarEvent[],
  role: string,
  today = getLocalDateString()
) {
  const mappedRole = mapRole(role);
  if (!mappedRole) return [];
  const roleEvents = events
    .filter((event) => event.roles.includes(mappedRole))
    .sort(compareEvents);

  const todayEntries = roleEvents
    .filter((event) => event.date === today)
    .map((event) => toTimelineLabel(event));

  if (todayEntries.length) {
    return todayEntries;
  }

  // If no event is scheduled for today, show the nearest saved events
  // so admins can confirm that calendar data was persisted.
  return roleEvents
    .slice(0, 6)
    .map((event) => `${event.date} ${toTimelineLabel(event)}`);
}
