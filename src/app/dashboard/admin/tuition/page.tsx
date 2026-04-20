import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import GenericDynamicPageEditor from "@/components/generic-dynamic-page-editor";

export const metadata = { title: "Tuition Page | Admin" };

export default async function TuitionAdminPage() {
  const session = await getServerSession();
  if (!session || session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const draft = {
    id: "",
    slug: "tuition",
    title: "Tuition & Financial Aid Page",
    published: false,
    sections: [
      { sectionKey: "banner", componentType: "BannerSection", position: 0, content: { title: "Tuition & Financial Aid", subtitle: "Affordable Education Options", bgImg: "/bannerImg.jpg" } },
      { sectionKey: "tuitionTable", componentType: "TuitionTableSection", position: 1, content: {} },
      { sectionKey: "scholarships", componentType: "WhyAustin", position: 2, content: {} },
      { sectionKey: "paymentPlans", componentType: "PaymentPlansSection", position: 3, content: {} },
      { sectionKey: "cta", componentType: "CtaSection", position: 4, content: {} },
    ],
  };

  return (
    <div className="w-full p-6">
      <GenericDynamicPageEditor slug="tuition" draft={draft} />
    </div>
  );
}
