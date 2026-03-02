type Audience = "BOTH" | "TEACHER_ONLY" | "STUDENT_ONLY";

type AnnouncementItem = {
  id: string;
  title: string;
  content: string;
  audience: Audience;
  expiresAt: string | null;
  createdAt: string;
};

type Props = {
  announcements: AnnouncementItem[];
};

function formatDate(value: string | null) {
  if (!value) return "No expiry";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No expiry";
  return date.toLocaleString();
}

export function AnnouncementsFeed({ announcements }: Props) {
  return (
    <section className="brand-card p-5">
      <p className="brand-section-title">Announcements</p>
      <div className="mt-3 space-y-3">
        {announcements.length ? (
          announcements.map((item) => (
            <article
              id={`announcement-${item.id}`}
              key={item.id}
              className="rounded-xl border border-[#c6ddfa] bg-[#f4f9ff] p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-[#0b3e81]">{item.title}</p>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[#2f5d96]">{item.content}</p>
              <div className="mt-2 text-xs text-[#3f70ae]">
                <p>Posted: {formatDate(item.createdAt)}</p>
                <p>Expires: {formatDate(item.expiresAt)}</p>
              </div>
            </article>
          ))
        ) : (
          <p className="brand-muted text-sm">No active announcements available.</p>
        )}
      </div>
    </section>
  );
}
