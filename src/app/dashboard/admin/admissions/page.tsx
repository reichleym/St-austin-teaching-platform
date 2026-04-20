import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import GenericDynamicPageEditor from "@/components/generic-dynamic-page-editor";

export const metadata = { title: "Admissions Page | Admin" };

export default async function AdmissionsAdminPage() {
  const session = await getServerSession();
  if (!session || session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const draft = {
    id: "",
    slug: "admissions",
    title: "Admissions Page",
    published: false,
    sections: [
      { sectionKey: "banner", componentType: "BannerSection", position: 0, content: { title: "Admissions", description: "Your Path to Success Starts Here", bgImg: "/bannerImg.jpg", buttonText: "Explore Programs" } },
      { sectionKey: "steps", componentType: "StepsSection", position: 1, content: {} },
      { sectionKey: "requirements", componentType: "RequirementsSection", position: 2, content: {} },
      { sectionKey: "deadlines", componentType: "DeadlinesSection", position: 3, content: {} },
      { sectionKey: "faq", componentType: "FaqSection", position: 4, content: {} },
      { sectionKey: "cta", componentType: "CtaSection", position: 5, content: {} },
    ],
  };

  return (
    <div className="w-full p-6">
      <GenericDynamicPageEditor slug="admissions" draft={draft} />
    </div>
  );
}
