import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function seedStudentExperience() {
  try {
    const client = prisma as unknown as Record<string, unknown>;
    if (!client.dynamicPage) {
      throw new Error(
        "Dynamic Pages database client is not available. Run `npm run db:generate` and restart the dev server."
      );
    }

    // Check if student experience page already exists
    const existing = await prisma.dynamicPage.findUnique({
      where: { slug: "studentExperience" },
    });

    if (existing) {
      console.log("Student Experience page already exists");
      return existing;
    }

    const localize = (content: Prisma.InputJsonObject): Prisma.InputJsonObject => ({
      sourceLanguage: "en",
      translations: {
        en: content,
        fr: content, // Copy English content to French as starting point
      },
    });

    // Create Student Experience page with sections from user schema
    const studentExperiencePage = await prisma.dynamicPage.create({
      data: {
        slug: "studentExperience",
        title: "Student Experience Page",
        published: false,
        sections: {
          create: [
            {
              sectionKey: "hero",
              componentType: "BannerSection",
              position: 0,
              content: localize({
                title: "Student Experience",
                description: "Discover the vibrant community and enriching experiences at St. Austin's International University.",
                bgImg: "/bannerImg.jpg",
              }),
            },
            {
              sectionKey: "how-youll-learn",
              componentType: "IconCard",
              position: 1,
              content: localize({
                title: "How You'll Learn",
                blockContent: [
                  {
                    cardTitle: "Flexible Online Learning",
                    cardDescription: "Study from anywhere with our state-of-the-art virtual classroom and asynchronous course materials.",
                    icon: "/awards-icon.png"
                  },
                  {
                    cardTitle: "Collaborative Community",
                    cardDescription: "Engage with peers through discussion forums, group projects, and networking events.",
                    icon: "/business-icon.png"
                  },
                  {
                    cardTitle: "Career Services",
                    cardDescription: "Resume workshops, mock interviews, job fairs, and direct employer connections for every student.",
                    icon: "/nursing-icon.png"
                  },
                  {
                    cardTitle: "24/7 Support",
                    cardDescription: "Study from anywhere with our state-of-the-art virtual classroom and asynchronous course materials.",
                    icon: "/awards-icon.png"
                  },
                  {
                    cardTitle: "Rich Resources",
                    cardDescription: "Engage with peers through discussion forums, group projects, and networking events.",
                    icon: "/business-icon.png"
                  },
                  {
                    cardTitle: "Global Network",
                    cardDescription: "Resume workshops, mock interviews, job fairs, and direct employer connections for every student.",
                    icon: "/nursing-icon.png"
                  }
                ]
              }),
            },
            {
              sectionKey: "learn-schedule",
              componentType: "CustomLearnSchedule",
              position: 2,
              content: localize({
                image: "cta-img.png",
                title: "Learn on Your Schedule",
                description: "Whether you're a working professional, a parent, or a career changer, our programs are designed to fit your life. Study anytime, anywhere with our award-winning online platform.",
                listContent: [
                  "Academic advising and mentorship",
                  "Writing center and tutoring",
                  "Disability and accessibility services",
                  "Mental health and wellness programs",
                  "Library and research support",
                  "Technology help desk"
                ]
              }),
            },
            {
              sectionKey: "learning-dashboard",
              componentType: "CustomLearningDashboard",
              position: 3,
              content: localize({
                image: "cta-img.png",
                title: "Your Learning Dashboard",
                description: "Our integrated portal gives you access to assignments, discussions, messaging, grades, and more — all in one place.",
                button: {
                  label: "Access the Portal",
                  variant: "primary"
                }
              }),
            },
            {
              sectionKey: "cta",
              componentType: "CtaSection",
              position: 4,
              content: localize({
                title: "Ready to Start Your Journey?",
                desc: "Take the next step toward your future. Our admissions team is here to guide you through every step of the process.",
                buttons: [
                  {"label": "Apply Now", "href": "/apply"},
                  {"label": "Request Info", "href": "/request-info"},
                  {"label": "Talk to an Advisor", "href": "#"}
                ]
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

    console.log("✅ Student Experience page seeded successfully");
    return studentExperiencePage;
  } catch (error) {
    console.error("❌ Error seeding student experience page:", error);
    throw error;
  }
}
