import { Metadata } from "next";
import { BannerSection } from "@/components/banner-section";
import { IconCard } from "@/components/icon-card";
import DynamicPageRenderer from "@/components/dynamic-page-renderer";

export const metadata: Metadata = {
  title: "About St. Austin's International University",
  description: "Learn about our mission, vision, and leadership team.",
};

export default async function AboutPage() {
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
        <h1 className="text-3xl font-bold">About Page</h1>
        <p className="text-gray-600 mt-2">
          Page content is being configured by admins. Please check back soon.
        </p>
      </div>
    );
  }

  const pageData = await res.json();

  return <DynamicPageRenderer page={pageData} />;
}
