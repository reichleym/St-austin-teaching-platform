import DynamicPageRenderer from '@/components/dynamic-page-renderer';
import { prisma } from '@/lib/prisma';

export default async function Page() {
  const row = await prisma.governmentEmployeesPage.findUnique({ where: { slug: 'government-employees' } });
  if (!row) return <div className="max-w-6xl mx-auto p-8">Government Employees page not found.</div>;

  const sectionRows = await prisma.governmentEmployeesPageSection.findMany({ where: { pageId: row.id }, orderBy: { position: 'asc' } });
  const sections = sectionRows.length
    ? sectionRows.map((s) => ({ sectionKey: s.sectionKey, componentType: s.componentType, position: s.position, content: s.content }))
    : Array.isArray(row.sections)
    ? row.sections
    : [];

  const page = {
    id: row.id,
    slug: row.slug,
    title: row.name,
    published: true,
    sections,
  };

  return (
    <main className="w-full">
      <DynamicPageRenderer page={page as unknown as any} />
    </main>
  );
}
