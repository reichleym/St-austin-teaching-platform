import { Metadata } from "next";
import DynamicPageRenderer from "@/components/dynamic-page-renderer";

export const metadata: Metadata = {
  title: "Student Experience - St. Austin's International University",
  description: "Discover the vibrant student experience, flexible learning options, and comprehensive support services at St. Austin's International University.",
};

export default async function StudentExperiencePage() {
  // Fetch from API (handles published check)
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/pages/studentExperience`, {
    next: { revalidate: 60 }, // ISR: revalidate every 60s
  });

  if (!res.ok) {
    // Try to render a local static JSON fallback if API page is not available
    try {
      const staticData = await import("@/lib/dynamic-pages/studentExperience.json");
      return <DynamicPageRenderer page={staticData.default} />;
    } catch (e) {
      // Final fallback UI if static file is missing or import fails
      return (
        <div className="min-h-screen py-20 px-4 md:px-8 bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-6">
              Student Experience
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed mb-8 max-w-2xl mx-auto">
              Our Student Experience page is being prepared.
              <br />
              <span className="font-semibold text-blue-600">Check back soon for details on learning flexibility, support services, and campus life!</span>
            </p>
          </div>
        </div>
      );
    }
  }

  const pageData = await res.json();

  return <DynamicPageRenderer page={pageData} />;
}
