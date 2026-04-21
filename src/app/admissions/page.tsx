import DynamicPageRenderer from '@/components/dynamic-page-renderer';
import { prisma } from '@/lib/prisma';

export default async function Page() {
  const pageRow = await prisma.dynamicPage.findUnique({
    where: { slug: 'admissions' },
    include: {
      sections: { orderBy: { position: 'asc' } },
      admissionsSections: { orderBy: { position: 'asc' } },
    },
  });
  if (!pageRow) return <div className="max-w-6xl mx-auto p-8">Admissions page not found.</div>;

  const p = pageRow as any;
  const resolved = (p.admissionsSections && p.admissionsSections.length > 0) ? p.admissionsSections : p.sections;
  const sections = (resolved || []).map((s: any) => ({ sectionKey: s.sectionKey, componentType: s.componentType, content: s.content }));

  const page = { id: pageRow.id, slug: pageRow.slug, title: pageRow.title, published: !!pageRow.published, sections };

  return (
    <main className="w-full">
      <DynamicPageRenderer page={page as unknown as any} />
    </main>
  );
}
