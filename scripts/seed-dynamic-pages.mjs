import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const pages = [
  {
    model: 'tuitionPage',
    payload: {
      slug: 'tuition',
      name: 'Tuition & Financial Aid Page',
      route: '/tuition',
      sections: [
        {
          sectionKey: 'banner',
          componentType: 'BannerSection',
          position: 0,
          content: {
            title: 'Tuition & Financial Aid',
            subtitle: 'Affordable Education Options',
            bgImg: '/bannerImg.jpg'
          }
        },
        {
          sectionKey: 'tuitionTable',
          componentType: 'TuitionTableSection',
          position: 1,
          content: {
            title: 'Tuition & Financial Aid',
            tableHeadings: ['Program Tuition', 'Per Year', 'Per Semester'],
            tableData: [
              { program: 'Undergraduate (Online)', perYear: '$12,500', perCredit: '$12,500' },
              { program: 'Computer Science', perYear: '$14,000', perCredit: '$14,000' },
              { program: 'Data Science', perYear: '$13,000', perCredit: '$13,000' },
              { program: 'Master of Business Administration', perYear: '$20,000', perCredit: '$20,000' }
            ]
          }
        },
        {
          sectionKey: 'scholarships',
          componentType: 'WhyAustin',
          position: 2,
          content: {
            secTitle: 'Scholarships & Grants',
            whiteCards: [
              { icon: '/wedding-certificate.svg', title: 'Academic Excellence', description: 'Reward Orientation Carriere' },
              { icon: '/global-learning.svg', title: 'Flexible Learning', description: 'Learn from experts and accomplished researchers' },
              { icon: '/workspace-premium.svg', title: 'Career-Focused', description: "92% placement rate with services of dedicated career and industry partnerships" },
              { icon: '/award-trophy.svg', title: 'Expert Faculty', description: 'Learn from industry practitioners and accomplished researchers' }
            ]
          }
        },
        {
          sectionKey: 'paymentPlans',
          componentType: 'PaymentPlansSection',
          position: 3,
          content: {
            title: 'Payment Plans',
            listContent: [
              'Monthly installment plans with no interest',
              'Military and veteran benefits accepted',
              'Employer tuition reimbursement processing',
              'Federal and state financial aid eligible'
            ],
            buttonText: 'Contact the financial aid office'
          }
        },
        {
          sectionKey: 'cta',
          componentType: 'CtaSection',
          position: 4,
          content: { className: 'md:pt-25 pt-15' }
        }
      ]
    }
  },
  {
    model: 'donationsPage',
    payload: {
      slug: 'donations',
      name: 'Donations Page',
      route: '/donations',
      sections: [
        { sectionKey: 'banner', componentType: 'BannerSection', position: 0, content: { title: 'Support Our Mission Through Donations', subtitle: "Help Us Make Education Accessible to Everyone", bgImg: '/bannerImg.jpg' } },
        { sectionKey: 'donationForm', componentType: 'DonationFormSection', position: 1, content: { title: 'Choose Your Donation Amount', oneTimeAmounts: ['XAF 2,500', 'XAF 5,000', 'XAF 10,000', 'XAF 25,000', 'XAF 50,000', 'XAF 100,000'], designationOptions: ['Where It\'s Needed Most', 'Student Scholarships', 'Campus Ministry', 'Academic Programs'], paymentMethods: [ { value: 'mtn_mobile_money', label: 'MTN Mobile Money (CamPay)' }, { value: 'orange_money', label: 'Orange Money (CamPay)' }, { value: 'credit_card', label: 'Credit Card (CamPay)' }, { value: 'bank_transfer', label: 'Bank Payment' } ] } },
        { sectionKey: 'whyGive', componentType: 'WhyGiveSection', position: 2, content: { stats: { raised: '$2.4M', students: '1,200+' }, description: "Your generosity directly impacts students' lives. Last year, donor-funded scholarships helped over 1,200 students complete their degrees and launch successful careers." } },
        { sectionKey: 'otherWays', componentType: 'OtherWaysSection', position: 3, content: { title: 'Other Ways to Give', items: [ 'Mail a check to St. Austin University, Office of Advancement', 'Donate stock, securities, or cryptocurrency', 'Include St. Austin in your estate plans', 'Set up a donor-advised fund gift' ] } },
        { sectionKey: 'impact', componentType: 'Accreditation', position: 4, content: { title: 'Your Impact', blockContent: [ { cardTitle: 'Student Scholarships', cardDescription: 'Every dollar donated funds scholarships to help students achieve their degrees and transform their careers.', icon: '/carbon_gui-management.png' }, { cardTitle: 'Academic Programs', cardDescription: 'Support the development of innovative programs that prepare students for the demands of a modern workforce.', icon: '/tabler_message-check.png' }, { cardTitle: 'Student Support Services', cardDescription: 'Help fund mentoring, tutoring, career counseling, and wellness resources for our diverse student body.', icon: '/hugeicons_progress-04.png' } ] } },
        { sectionKey: 'matchingGift', componentType: 'MatchingGiftSection', position: 5, content: {} },
        { sectionKey: 'cta', componentType: 'CtaSection', position: 6, content: {} }
      ]
    }
  },
  {
    model: 'governmentEmployeesPage',
    payload: {
      slug: 'government-employees',
      name: 'Government Employees Page',
      route: '/government-employees',
      sections: [
        { sectionKey: 'banner', componentType: 'BannerSection', position: 0, content: { title: 'Special Programs for Government Employees', description: 'Exclusive Benefits & Discounts', bgImg: '/bannerImg.jpg' } },
        { sectionKey: 'discountCard', componentType: 'GovernmentEmployeeDiscountCard', position: 1, content: { discountPercent: 25, contactEmail: 'govtservices@staustin.edu' } },
        { sectionKey: 'howItWorks', componentType: 'HowItWorksSection', position: 2, content: { title: 'How the Discount Works', steps: [ 'Sign in, select your category, and submit your government employee ID.', 'Receive the application fee only after admin approval.', 'Email your ID details to govtservices@staustin.edu for review before discount activation.' ] } },
        { sectionKey: 'supportGroups', componentType: 'SupportGroupsSection', position: 3, content: { title: 'Support by Government Employee Group', description: 'We have grouped public-sector learners so each team gets relevant guidance, benefits, and academic pathways.', groups: [ { title: 'Civil Service Employees', summary: 'For ministry, council, and agency staff looking to strengthen management, policy, and digital skills.', support: [ 'Public administration pathways', 'Weekend and evening options', 'Employer-sponsored study support' ] }, { title: 'Veterans and Active-Duty Personnel', summary: 'For service members and veterans transitioning into civilian careers or advancing their qualifications.', support: [ 'Transition-focused advising', 'Recognition of prior service experience', 'Career planning and placement support' ] }, { title: 'Public Safety Personnel', summary: 'For police, emergency, and security professionals balancing duty schedules with academic goals.', support: [ 'Shift-friendly scheduling', 'Leadership and operations upskilling', 'Progress tracking with advisor support' ] }, { title: 'Public Health and Education Workers', summary: 'For government-employed teachers, health workers, and administrators seeking advancement.', support: [ 'Program tracks for service delivery roles', 'Practical, career-aligned curriculum', 'Support for long-term professional growth' ] } ] } },
        { sectionKey: 'cta', componentType: 'CtaSection', position: 4, content: { title: 'Ready to Begin?', buttons: [ { text: 'Start Application', href: '/apply' }, { text: 'View Programs', href: '/program' } ] } }
      ]
    }
  },
  {
    model: 'admissionsPage',
    payload: {
      slug: 'admissions',
      name: 'Admissions Page',
      route: '/admissions',
      sections: [
        { sectionKey: 'banner', componentType: 'BannerSection', position: 0, content: { title: 'Admissions', description: 'Your Path to Success Starts Here', bgImg: '/bannerImg.jpg', buttonText: 'Explore Programs' } },
        { sectionKey: 'steps', componentType: 'StepsSection', position: 1, content: { title: 'How to Apply', stepsContent: [ { cardTitle: 'Submit Application', cardDescription: 'Complete our online application form with your personal and academic information.', stepNum: '01' }, { cardTitle: 'Submit Documents', cardDescription: 'Upload your transcripts, test scores, and letters of recommendation.', stepNum: '02' }, { cardTitle: 'Review & Interview', cardDescription: 'Our admissions team will review your application and schedule an interview.', stepNum: '03' }, { cardTitle: 'Receive Decision', cardDescription: 'Get your admission decision and enrollment information.', stepNum: '04' } ] } },
        { sectionKey: 'requirements', componentType: 'RequirementsSection', position: 2, content: { title: 'Admission Requirements', requirementsDesc: 'To be considered for admission, applicants must meet the following requirements:', listContent: [ 'High school diploma or equivalent (GED)', 'Minimum GPA of 2.5', 'TOEFL score of 79+ (for international students)', 'Completed application form', 'Two letters of recommendation' ], image: '/cta-img.png' } },
        { sectionKey: 'deadlines', componentType: 'DeadlinesSection', position: 3, content: { title: 'Important Deadlines', deadlineItem: [ { title: 'September Intake', headingOne: 'Priority Deadline', headingTwo: 'Final Deadline', dateOne: 'July 15', dateTwo: 'August 31' }, { title: 'January Intake', headingOne: 'Priority Deadline', headingTwo: 'Final Deadline', dateOne: 'November 1', dateTwo: 'December 15' }, { title: 'May Intake', headingOne: 'Priority Deadline', headingTwo: 'Final Deadline', dateOne: 'March 1', dateTwo: 'April 15' } ] } },
        { sectionKey: 'faq', componentType: 'FaqSection', position: 4, content: { title: 'Frequently Asked Questions', accordionsContent: [ { title: 'What is the application deadline?', description: 'We accept applications on a rolling basis. Apply as early as possible for better course availability.' }, { title: 'What are the tuition fees?', description: 'Tuition varies by program. Please contact our admissions team for detailed pricing.' }, { title: 'When does the academic year start?', description: 'The academic year typically starts in September. We also offer spring and summer intakes.' }, { title: 'Do you offer financial aid?', description: 'Yes! We offer scholarships, grants, and flexible payment plans.' } ] } },
        { sectionKey: 'cta', componentType: 'CtaSection', position: 5, content: {} }
      ]
    }
  }
];

async function upsertPages() {
  try {
    for (const p of pages) {
      const modelName = p.model; // e.g., 'tuitionPage'
      const payload = p.payload;

      // Prisma client uses camelCase model names matching schema names
      // map model string to actual prisma function
      if (!prisma[modelName]) {
        console.warn(`Prisma model not found: ${modelName}. Skipping.`);
        continue;
      }

      const where = { slug: payload.slug };
      const create = payload;
      const update = { name: payload.name, route: payload.route, sections: payload.sections };

      const res = await prisma[modelName].upsert({ where, update, create });
      console.log(`Upserted ${modelName}: ${res.slug}`);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

upsertPages();
