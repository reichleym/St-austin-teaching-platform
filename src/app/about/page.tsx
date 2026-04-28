import { Metadata } from "next";
import { BannerSection } from "@/components/banner-section";
import { IconCard } from "@/components/icon-card";
import DynamicPageRenderer from "@/components/dynamic-page-renderer";
import { createServerTranslator } from "@/lib/i18n-server";

export const metadata: Metadata = {
  title: "About St. Austin's International University",
  description: "Learn about our mission, vision, and leadership team.",
};

export default async function AboutPage() {
  const t = await createServerTranslator();
  // Fetch the page from the database
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/pages/about`, {
    next: { revalidate: 60 }, // Revalidate every 60 seconds
  });

  if (!res.ok) {
    // Fallback to default content if page not found or not published
    return (
      <div className="p-6 text-center">
        <h1 className="text-3xl font-bold">{t("dynamicPages.public.aboutFallbackTitle")}</h1>
        <p className="text-gray-600 mt-2">
          {t("dynamicPages.public.aboutFallbackMessage")}
        </p>
      </div>
    );
  }

  const pageData = await res.json();

  return <DynamicPageRenderer page={pageData} />;
}
