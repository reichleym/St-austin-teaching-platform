"use client";

import { BannerSection } from "./banner-section";
import { IconCard } from "./icon-card";
import { CtaSection } from "./cta-section";
import { useLanguage } from "@/components/language-provider";
import { resolveLocalizedSectionContent } from "@/lib/dynamic-page-localization";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asArrayOfObjects(value: unknown): JsonObject[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isJsonObject);
}

interface PageSection {
  id?: string;
  sectionKey: string;
  componentType: string;
  position: number;
  content: JsonObject;
}

interface DynamicPage {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  sections: PageSection[];
}

interface DynamicPageRendererProps {
  page: DynamicPage;
}

// Map component types to actual components
const componentMap: Record<string, React.ComponentType<Record<string, unknown>>> = {
  BannerSection: BannerSection as React.ComponentType<Record<string, unknown>>,
  IconCard: IconCard as React.ComponentType<Record<string, unknown>>,
  CtaSection: CtaSection as React.ComponentType<Record<string, unknown>>,
  // Add more component types as needed
};

// Custom sections that don't have dedicated components
const CustomSectionComponents: Record<string, React.ComponentType<{ content: JsonObject }>> = {
  HistorySection: ({ content }) => (
    <section className="py-16 px-4 md:px-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div>
          <h2 className="text-3xl font-bold mb-4">{asString(content["title"])}</h2>
          <p className="text-gray-700 leading-relaxed">{asString(content["description"])}</p>
        </div>
        {asString(content["image"]) ? (
          <div className="overflow-hidden rounded-lg">
            <img
              src={asString(content["image"])}
              alt={asString(content["title"])}
              className="w-full h-auto"
            />
          </div>
        ) : null}
      </div>
    </section>
  ),

  MissionVisionSection: ({ content }) => (
    <section className="py-16 px-4 md:px-8 bg-gradient-to-r from-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {isJsonObject(content["mission"]) ? (
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-2xl font-bold mb-3 text-blue-600">
              {asString((content["mission"] as JsonObject)["title"])}
            </h3>
            <p className="text-gray-700 leading-relaxed">
              {asString((content["mission"] as JsonObject)["desc"])}
            </p>
          </div>
        ) : null}
        {isJsonObject(content["vision"]) ? (
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-2xl font-bold mb-3 text-indigo-600">
              {asString((content["vision"] as JsonObject)["title"])}
            </h3>
            <p className="text-gray-700 leading-relaxed">
              {asString((content["vision"] as JsonObject)["desc"])}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  ),

  TeamGridSection: ({ content }) => (
    <section className="py-16 px-4 md:px-8">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-12 text-center">{asString(content["title"])}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {asArrayOfObjects(content["teamMembers"]).map((member) => {
            const name = asString(member["name"]);
            const role = asString(member["role"]);
            const image = asString(member["image"]);
            const description = asString(member["description"]);
            return (
              <div key={name || role} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                {image ? (
                  <div className="overflow-hidden h-48 bg-gray-200">
                    <img src={image} alt={name} className="w-full h-full object-cover" />
                  </div>
                ) : null}
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-1">{name}</h3>
                  <p className="text-blue-600 text-sm font-semibold mb-3">{role}</p>
                  <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  ),

  CoreValuesSection: ({ content }) => (
    <section className="py-16 px-4 md:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {asString(content["title"]) ? <h2 className="text-3xl font-bold mb-12 text-center">{asString(content["title"])}</h2> : null}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {asArrayOfObjects(content["values"]).map((value, index) => (
              <div
                key={index}
                className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition"
              >
                <h3 className="text-xl font-bold mb-3 text-blue-600">
                  {asString(value["title"])}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {asString(value["description"])}
                </p>
              </div>
            ))}
        </div>
      </div>
    </section>
  ),

  LearnSchedule: ({ content }) => (
    <section className="py-16 px-4 md:px-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {asString(content["image"]) ? (
          <div className="overflow-hidden rounded-lg">
            <img src={asString(content["image"])} alt={asString(content["title"])} className="w-full h-auto" />
          </div>
        ) : null}
        <div>
          <h2 className="text-3xl font-bold mb-4">{asString(content["title"])}</h2>
          <p className="text-gray-700 leading-relaxed mb-4">{asString(content["description"])}</p>
          <ul className="list-disc pl-5 space-y-2">
            {Array.isArray(content["list"]) && (content["list"] as unknown[]).map((item, idx) => (
              <li key={idx} className="text-gray-700">{asString(item)}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  ),

  LearningDashboardCta: ({ content }) => (
    <section className="py-16 px-4 md:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div>
          <h2 className="text-3xl font-bold mb-4">{asString(content["title"])}</h2>
          <p className="text-gray-700 leading-relaxed mb-6">{asString(content["description"])}</p>
          {isJsonObject(content["button"]) ? (
            isJsonObject(content["button"]) && asString((content["button"] as JsonObject)["href"]) ? (
              <a href={asString((content["button"] as JsonObject)["href"]) } className="btn-brand-primary px-5 py-2.5 text-sm font-semibold">
                {asString((content["button"] as JsonObject)["label"])}
              </a>
            ) : (
              <button className="btn-brand-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-60" disabled>
                {asString((content["button"] as JsonObject)["label"]) || "Access the Portal"}
              </button>
            )
          ) : null}
        </div>
        {asString(content["image"]) ? (
          <div className="overflow-hidden rounded-lg">
            <img src={asString(content["image"]) } alt={asString(content["title"]) } className="w-full h-auto" />
          </div>
        ) : null}
      </div>
    </section>
  ),

  StatisticsSection: ({ content }) => (
    <section className="py-16 px-4 md:px-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
      <div className="max-w-6xl mx-auto">
        {asString(content["title"]) ? <h2 className="text-3xl font-bold mb-4 text-center">{asString(content["title"])}</h2> : null}
        {asString(content["description"]) ? <p className="text-center mb-12 text-blue-50">{asString(content["description"])}</p> : null}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {asArrayOfObjects(content["stats"]).map((stat, index) => (
              <div
                key={index}
                className="bg-white bg-opacity-10 backdrop-blur-sm p-6 rounded-lg text-center hover:bg-opacity-20 transition"
              >
                <div className="text-4xl font-bold mb-2">{asString(stat["number"])}</div>
                <h3 className="text-lg font-semibold mb-2">{asString(stat["label"])}</h3>
                {asString(stat["description"]) ? <p className="text-sm text-blue-50">{asString(stat["description"])}</p> : null}
              </div>
            ))}
        </div>
      </div>
    </section>
  ),
};

export default function DynamicPageRenderer({ page }: DynamicPageRendererProps) {
  const { language } = useLanguage();
  return (
    <div className="w-full">
      {page.sections
        .sort((a, b) => a.position - b.position)
        .map((section) => {
          const resolvedContent = resolveLocalizedSectionContent(section.content, language);
          // First check custom components
          const CustomComponent = CustomSectionComponents[section.componentType];
          if (CustomComponent) {
            return (
              <CustomComponent key={section.id || section.sectionKey} content={resolvedContent} />
            );
          }

          // Then check standard component map
          const Component = componentMap[section.componentType];
          if (Component) {
            return <Component key={section.id || section.sectionKey} {...resolvedContent} />;
          }

          // Fallback for unknown components
          return (
            <section
              key={section.id || section.sectionKey}
              className="py-16 px-4 md:px-8 border-2 border-yellow-300 bg-yellow-50"
            >
              <div className="max-w-6xl mx-auto">
                <div className="text-yellow-800 font-semibold">
                  Unknown component type: {section.componentType}
                </div>
                <details className="mt-4">
                  <summary className="cursor-pointer font-semibold text-yellow-700">
                    Content Details
                  </summary>
                  <pre className="mt-2 bg-white p-4 rounded border text-xs overflow-auto">
                    {JSON.stringify(resolvedContent, null, 2)}
                  </pre>
                </details>
              </div>
            </section>
          );
        })}
    </div>
  );
}
