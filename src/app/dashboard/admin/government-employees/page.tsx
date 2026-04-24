import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import GenericDynamicPageEditor from "@/components/generic-dynamic-page-editor";

export const metadata = { title: "Government Employees Page | Admin" };

export default async function GovEmployeesAdminPage() {
  const session = await getServerSession();
  if (!session || session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const draft = {
    id: "",
    slug: "government-employees",
    title: "Government Employees Page",
    published: false,
    sections: [
      { sectionKey: "banner", componentType: "BannerSection", position: 0, content: { title: "Special Programs for Government Employees", description: "Exclusive Benefits & Discounts", bgImg: "/bannerImg.jpg" } },
      { sectionKey: "discountCard", componentType: "GovernmentEmployeeDiscountCard", position: 1, content: {} },
      { sectionKey: "howItWorks", componentType: "HowItWorksSection", position: 2, content: {} },
      { sectionKey: "supportGroups", componentType: "SupportGroupsSection", position: 3, content: {} },
      { sectionKey: "quickLinks", componentType: "QuickLinksSection", position: 4, content: {} },
      { sectionKey: "cta", componentType: "CtaSection", position: 5, content: {} },
    ],
  };

  return (
    <div className="w-full p-6">
      <GenericDynamicPageEditor slug="government-employees" draft={draft} />
    </div>
  );
}
