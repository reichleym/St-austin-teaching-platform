import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function seedAboutPage() {
  try {
    const client = prisma as unknown as Record<string, unknown>;
    if (!client.dynamicPage) {
      throw new Error(
        "Dynamic Pages database client is not available. Run `npm run db:generate` and restart the dev server."
      );
    }

    // Check if about page already exists
    const existing = await prisma.dynamicPage.findUnique({
      where: { slug: "about" },
    });

    if (existing) {
      console.log("About page already exists");
      return existing;
    }

    const localize = (content: Prisma.InputJsonObject): Prisma.InputJsonObject => ({
      sourceLanguage: "en",
      translations: {
        en: content,
        fr: content,
      },
    });

    // Create the about page with sections
    const aboutPage = await prisma.dynamicPage.create({
      data: {
        slug: "about",
        title: "About St. Austin's International University",
        published: false,
        sections: {
          create: [
            {
              sectionKey: "hero",
              componentType: "BannerSection",
              position: 0,
              content: localize({
                title: "About St. Austin's International University",
                description: "Our Mission",
                bgImg: "/bannerImg.jpg",
              }),
            },
            {
              sectionKey: "history",
              componentType: "HistorySection",
              position: 1,
              content: localize({
                title: "Our History",
                description:
                  "Founded in 1995, St. Austin's International University has been dedicated to providing career-focused education for over 25 years. Starting as a small institution with just 50 students, we have grown to serve thousands of students annually while maintaining our commitment to personalized education and career success.",
                image: "/cta-img.png",
              }),
            },
            {
              sectionKey: "mission-vision",
              componentType: "MissionVisionSection",
              position: 2,
              content: localize({
                mission: {
                  title: "Our Mission",
                  desc: "To empower individuals through accessible, high-quality education that bridges academic excellence with practical career readiness.",
                },
                vision: {
                  title: "Our Vision",
                  desc: "To be a global leader in career-focused higher education, recognized for innovation, inclusivity, and student success.",
                },
              }),
            },
            {
              sectionKey: "accreditation",
              componentType: "IconCard",
              position: 3,
              content: localize({
                title: "Accreditation",
                blockContent: [
                  {
                    cardTitle: "National Board of Higher Education",
                    cardDescription: "National Board of Higher Education",
                    icon: "/awards-icon.png",
                  },
                  {
                    cardTitle: "Business Programs",
                    cardDescription:
                      "International accreditation for business programs",
                    icon: "/business-icon.png",
                  },
                  {
                    cardTitle: "Nursing Programs",
                    cardDescription:
                      "Commission on Collegiate Nursing Education",
                    icon: "/nursing-icon.png",
                  },
                ],
              }),
            },
            {
              sectionKey: "leadership",
              componentType: "TeamGridSection",
              position: 4,
              content: localize({
                title: "Leadership Team",
                teamMembers: [
                  {
                    name: "Dr. Margaret Chen",
                    role: "President",
                    image: "/team1.jpg",
                    description:
                      "Dr. Chen brings over 25 years of academic leadership experience and a vision for accessible, career-oriented education.",
                  },
                  {
                    name: "Dr. Robert Williams",
                    role: "Provost & VP of Academic Affairs",
                    image: "/team1.jpg",
                    description:
                      "A distinguished scholar in educational innovation, Dr. Williams oversees curriculum development and academic quality.",
                  },
                  {
                    name: "Dr. Amara Osei",
                    role: "Dean of Student Affairs",
                    image: "/team1.jpg",
                    description:
                      "Dr. Osei is passionate about student success and leads initiatives in mentorship, career services, and community building.",
                  },
                  {
                    name: "Prof. David Nakamura",
                    role: "Dean of Technology",
                    image: "/team1.jpg",
                    description:
                      "Prof. Nakamura drives the university's technology programs and digital learning infrastructure with industry expertise.",
                  },
                ],
              }),
            },
            {
              sectionKey: "cta",
              componentType: "CtaSection",
              position: 5,
              content: localize({
                title: "Ready to Start Your Journey?",
                desc: "Take the next step toward your future. Our admissions team is here to guide you through every step of the process.",
                buttons: ["Apply Now", "Request Info", "Talk to an Advisor"],
              }),
            },
          ],
        },
      },
      include: {
        sections: {
          orderBy: { position: "asc" },
        },
      },
    });

    console.log("About page seeded successfully");
    return aboutPage;
  } catch (error) {
    console.error("Error seeding about page:", error);
    throw error;
  }
}
