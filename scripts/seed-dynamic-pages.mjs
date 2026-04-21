#!/usr/bin/env node
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function upsertPage(slug, title, sections) {
  console.log(`Upserting page ${slug}`);
  await prisma.dynamicPage.upsert({
    where: { slug },
    update: { title, sections: { deleteMany: {}, create: sections } },
    create: { slug, title, published: true, sections: { create: sections } },
  });
}

const donationsSections = [
  {
    sectionKey: 'hero',
    componentType: 'BannerSection',
    position: 0,
    content: { sourceLanguage: 'en', translations: { en: { title: 'Support Our Mission', description: 'Your gift helps students achieve their goals.', bgImg: '/bannerImg.jpg' }, fr: { title: 'Support Our Mission', description: 'Votre don aide les étudiants.', bgImg: '/bannerImg.jpg' } } },
  },
  {
    sectionKey: 'how-to-give',
    componentType: 'IconCard',
    position: 1,
    content: { sourceLanguage: 'en', translations: { en: { title: 'How to Give', blockContent: [{ cardTitle: 'Online', cardDescription: 'Secure online donations.', icon: '/awards-icon.png' }] }, fr: { title: 'Comment donner', blockContent: [{ cardTitle: 'En ligne', cardDescription: 'Dons sécurisés.', icon: '/awards-icon.png' }] } } },
  },
  {
    sectionKey: 'donationForm',
    componentType: 'DonationFormSection',
    position: 2,
    content: { sourceLanguage: 'en', translations: { en: { title: 'Choose Your Donation Amount', oneTimeAmounts: ['XAF 2,500', 'XAF 5,000', 'XAF 10,000', 'XAF 25,000', 'XAF 50,000', 'XAF 100,000'], designationOptions: ['Where It\'s Needed Most', 'Student Scholarships', 'Campus Ministry', 'Academic Programs'], paymentMethods: [{ value: 'mtn_mobile_money', label: 'MTN Mobile Money (CamPay)' }, { value: 'orange_money', label: 'Orange Money (CamPay)' }, { value: 'credit_card', label: 'Credit Card (CamPay)' }, { value: 'bank_transfer', label: 'Bank Payment' }] }, fr: { title: 'Choose Your Donation Amount', oneTimeAmounts: ['XAF 2,500', 'XAF 5,000', 'XAF 10,000'], designationOptions: ['Where It\'s Needed Most'], paymentMethods: [{ value: 'mtn_mobile_money', label: 'MTN Mobile Money (CamPay)' }] } } },
  },
  {
    sectionKey: 'whyGive',
    componentType: 'WhyGiveSection',
    position: 3,
    content: { sourceLanguage: 'en', translations: { en: { stats: { raised: '$2.4M', students: '1,200+' }, description: 'Your generosity directly impacts students\' lives. Last year, donor-funded scholarships helped over 1,200 students complete their degrees and launch successful careers.' }, fr: { stats: { raised: '$2.4M', students: '1,200+' }, description: 'Your generosity directly impacts students\' lives.' } } },
  },
  {
    sectionKey: 'otherWays',
    componentType: 'OtherWaysSection',
    position: 4,
    content: { sourceLanguage: 'en', translations: { en: { title: 'Other Ways to Give', items: ['Mail a check to St. Austin University, Office of Advancement', 'Donate stock, securities, or cryptocurrency', 'Include St. Austin in your estate plans', 'Set up a donor-advised fund gift'] }, fr: { title: 'Other Ways to Give', items: ['Mail a check to St. Austin University, Office of Advancement'] } } },
  },
  {
    sectionKey: 'impact',
    componentType: 'Accreditation',
    position: 5,
    content: { sourceLanguage: 'en', translations: { en: { title: 'Your Impact', blockContent: [ { cardTitle: 'Student Scholarships', cardDescription: 'Every dollar donated funds scholarships to help students achieve their degrees and transform their careers.', icon: '/carbon_gui-management.png' }, { cardTitle: 'Academic Programs', cardDescription: 'Support the development of innovative programs that prepare students for the demands of a modern workforce.', icon: '/tabler_message-check.png' }, { cardTitle: 'Student Support Services', cardDescription: 'Help fund mentoring, tutoring, career counseling, and wellness resources for our diverse student body.', icon: '/hugeicons_progress-04.png' } ] }, fr: { title: 'Your Impact', blockContent: [] } } },
  },
  { sectionKey: 'matchingGift', componentType: 'MatchingGiftSection', position: 6, content: { sourceLanguage: 'en', translations: { en: {}, fr: {} } } },
  { sectionKey: 'cta', componentType: 'CtaSection', position: 7, content: { sourceLanguage: 'en', translations: { en: {}, fr: {} } } },
];

const tuitionSections = [
  {
    sectionKey: 'hero',
    componentType: 'BannerSection',
    position: 0,
    content: { sourceLanguage: 'en', translations: { en: { title: 'Tuition & Financial Aid', description: 'Learn about tuition and aid.', bgImg: '/bannerImg.jpg' }, fr: { title: 'Frais de scolarité', description: 'En savoir plus.', bgImg: '/bannerImg.jpg' } } },
  },
  {
    sectionKey: 'tuitionTable',
    componentType: 'TuitionTableSection',
    position: 1,
    content: { sourceLanguage: 'en', translations: { en: { title: 'Tuition Table', tableHeadings: ['Program', 'Per Year', 'Per Semester'], tableData: [{ program: 'Undergraduate', perYear: '$12,300', perCredit: '$12,300' }] }, fr: { title: 'Tableau des frais', tableHeadings: ['Programme', 'Par an', 'Par semestre'], tableData: [{ program: 'Licence', perYear: '$12,300', perCredit: '$12,300' }] } } },
  },
  {
    sectionKey: 'scholarships',
    componentType: 'WhyAustin',
    position: 2,
    content: { sourceLanguage: 'en', translations: { en: { secTitle: 'Scholarships & Grants', whiteCards: [ { icon: '/wedding-certificate.svg', title: 'Academic Excellence', description: 'Reward Orientation Carriere' }, { icon: '/global-learning.svg', title: 'Flexible Learning', description: 'Learn from experts and accomplished researchers' }, { icon: '/workspace-premium.svg', title: 'Career-Focused', description: '92% placement rate with services of dedicated career and industry partnerships' } ] }, fr: { secTitle: 'Bourses', whiteCards: [{ icon: '/wedding-certificate.svg', title: 'Excellence académique', description: 'Récompense' }] } } },
  },
  {
    sectionKey: 'paymentPlans',
    componentType: 'PaymentPlansSection',
    position: 3,
    content: { sourceLanguage: 'en', translations: { en: { title: 'Payment Plans', listContent: ['Monthly installment plans with no interest', 'Military and veteran benefits accepted', 'Employer tuition reimbursement processing'], buttonText: 'Contact the financial aid office' }, fr: { title: 'Plans de paiement', listContent: ['Plans d\'échelonnement mensuels sans intérêt'], buttonText: 'Contactez le bureau d\'aide financière' } } },
  },
  { sectionKey: 'cta', componentType: 'CtaSection', position: 4, content: { sourceLanguage: 'en', translations: { en: {}, fr: {} } } },
];

const govtSections = [
  {
    sectionKey: 'banner',
    componentType: 'BannerSection',
    position: 0,
    content: { sourceLanguage: 'en', translations: { en: { title: 'Special Programs for Government Employees', description: 'Exclusive Benefits & Discounts', bgImg: '/bannerImg.jpg' }, fr: { title: 'Programmes spéciaux', description: 'Avantages et réductions', bgImg: '/bannerImg.jpg' } } },
  },
  {
    sectionKey: 'discountCard',
    componentType: 'GovernmentEmployeeDiscountCard',
    position: 1,
    content: { sourceLanguage: 'en', translations: { en: { discountPercent: 25, contactEmail: 'govtservices@staustin.edu' }, fr: { discountPercent: 25, contactEmail: 'govtservices@staustin.edu' } } },
  },
  {
    sectionKey: 'howItWorks',
    componentType: 'HowItWorksSection',
    position: 2,
    content: { sourceLanguage: 'en', translations: { en: { title: 'How the Discount Works', steps: ['Sign in, select your category, and submit your government employee ID.', 'Receive the application fee only after admin approval.', 'Email your ID details to govtservices@staustin.edu for review before discount activation.'] }, fr: { title: 'Comment fonctionne la réduction', steps: ['Connectez-vous, sélectionnez votre catégorie et soumettez votre ID.', 'Recevez les frais uniquement après approbation.', 'Envoyez vos détails à govtservices@staustin.edu pour examen.'] } } },
  },
  {
    sectionKey: 'supportGroups',
    componentType: 'SupportGroupsSection',
    position: 3,
    content: { sourceLanguage: 'en', translations: { en: { title: 'Support by Government Employee Group', description: 'Grouped public-sector learners for tailored guidance and benefits.', groups: [ { title: 'Civil Service Employees', summary: 'For ministry, council, and agency staff.', support: ['Public administration pathways', 'Weekend and evening options'] }, { title: 'Veterans and Active-Duty Personnel', summary: 'For service members and veterans.', support: ['Transition-focused advising', 'Recognition of prior service experience'] } ] }, fr: { title: 'Support par groupe', description: 'Groupes d\'apprenants du secteur public.', groups: [] } } },
  },
  { sectionKey: 'cta', componentType: 'CtaSection', position: 4, content: { sourceLanguage: 'en', translations: { en: { title: 'Ready to Begin?', buttons: [{ text: 'Start Application', href: '/apply' }, { text: 'View Programs', href: '/program' }] }, fr: { title: 'Prêt à commencer ?', buttons: [{ text: 'Commencer la candidature', href: '/apply' }, { text: 'Voir les programmes', href: '/program' }] } } } },
];

const admissionsSections = [
  {
    sectionKey: 'hero',
    componentType: 'BannerSection',
    position: 0,
    content: { sourceLanguage: 'en', translations: { en: { title: 'Admissions', description: "Start your application to St. Austin's." }, fr: { title: 'Admissions', description: 'Commencez votre demande.' } } },
  },
  {
    sectionKey: 'requirements',
    componentType: 'RequirementsSection',
    position: 1,
    content: { sourceLanguage: 'en', translations: { en: { secTitle: 'Admission Requirements', listContent: ['High school transcript and application.'] }, fr: { secTitle: 'Conditions d\'admission', listContent: ['Attestation de résultat'] } } },
  },
];

// Expand admissions to include steps, deadlines, faqs, and cta so editor shows full page
admissionsSections.push(
  {
    sectionKey: 'steps',
    componentType: 'StepsSection',
    position: 2,
    content: { sourceLanguage: 'en', translations: { en: { title: 'How to Apply', stepsContent: [{ cardTitle: 'Create an account', cardDescription: 'Start your application by creating an account.', stepNum: '1' }, { cardTitle: 'Submit documents', cardDescription: 'Upload transcripts and test scores.', stepNum: '2' }] }, fr: { title: 'Comment postuler', stepsContent: [{ cardTitle: 'Créer un compte', cardDescription: 'Commencez en créant un compte.', stepNum: '1' }, { cardTitle: 'Soumettre des documents', cardDescription: 'Téléversez vos documents.', stepNum: '2' }] } } },
  },
  {
    sectionKey: 'deadlines',
    componentType: 'DeadlinesSection',
    position: 3,
    content: { sourceLanguage: 'en', translations: { en: { title: 'Important Deadlines', deadlineItem: [{ title: 'Regular Decision', headingOne: 'Apply by', headingTwo: 'Notification', dateOne: 'Jan 15', dateTwo: 'Mar 1' }] }, fr: { title: 'Dates importantes', deadlineItem: [{ title: 'Décision régulière', headingOne: 'Date limite', headingTwo: 'Notification', dateOne: '15 janv.', dateTwo: '1 mars' }] } } },
  },
  {
    sectionKey: 'faqs',
    componentType: 'FaqSection',
    position: 4,
    content: { sourceLanguage: 'en', translations: { en: { title: 'Frequently Asked Questions', accordionsContent: [{ title: 'Do I need test scores?', description: 'Requirements vary by program.' }] }, fr: { title: 'Questions fréquentes', accordionsContent: [{ title: 'Ai-je besoin de résultats?', description: 'Les exigences varient.' }] } } },
  },
  {
    sectionKey: 'cta',
    componentType: 'CtaSection',
    position: 5,
    content: { sourceLanguage: 'en', translations: { en: { title: 'Ready to apply?', desc: 'Start your application today.', buttons: ['Apply now'] }, fr: { title: 'Prêt à postuler?', desc: "Commencez votre demande aujourd'hui.", buttons: ['Postuler'] } } },
  }
);

async function main() {
  try {
    await upsertPage('donations', 'Donations', donationsSections);
    await upsertPage('tuition', 'Tuition & Financial Aid', tuitionSections);
    await upsertPage('government-employees', 'Government Employees', govtSections);
    await upsertPage('admissions', 'Admissions', admissionsSections);
    console.log('Seeding complete');
  } catch (err) {
    console.error('Seeding failed', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
