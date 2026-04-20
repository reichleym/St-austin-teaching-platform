import DynamicPageRenderer from '@/components/dynamic-page-renderer';
import { prisma } from '@/lib/prisma';

export default async function Page() {
  const row = await prisma.tuitionPage.findUnique({ where: { slug: 'tuition' } });
  if (!row) return <div className="max-w-6xl mx-auto p-8">Tuition page not found.</div>;

  const page = {
    id: row.id,
    slug: row.slug,
    title: row.name,
    published: true,
    sections: Array.isArray(row.sections) ? row.sections : [],
  };

  return (
    <main className="w-full">
      <DynamicPageRenderer page={page} />
    </main>
  );
}
