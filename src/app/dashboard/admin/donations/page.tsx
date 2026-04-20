import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import GenericDynamicPageEditor from "@/components/generic-dynamic-page-editor";

export const metadata = { title: "Donations Page | Admin" };

export default async function DonationsAdminPage() {
  const session = await getServerSession();
  if (!session || session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const draft = {
    id: "",
    slug: "donations",
    title: "Donations Page",
    published: false,
    sections: [
      { sectionKey: "banner", componentType: "BannerSection", position: 0, content: { title: "Support Our Mission Through Donations", subtitle: "Help Us Make Education Accessible to Everyone", bgImg: "/bannerImg.jpg" } },
      { sectionKey: "donationForm", componentType: "DonationFormSection", position: 1, content: {} },
      { sectionKey: "whyGive", componentType: "WhyGiveSection", position: 2, content: {} },
      { sectionKey: "otherWays", componentType: "OtherWaysSection", position: 3, content: {} },
      { sectionKey: "impact", componentType: "Accreditation", position: 4, content: {} },
      { sectionKey: "matchingGift", componentType: "MatchingGiftSection", position: 5, content: {} },
      { sectionKey: "cta", componentType: "CtaSection", position: 6, content: {} },
    ],
  };

  return (
    <div className="w-full p-6">
      <GenericDynamicPageEditor slug="donations" draft={draft} />
    </div>
  );
}
