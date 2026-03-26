import type { Metadata } from "next";
import "./globals.css";
import { AppToastProvider } from "@/components/app-toast-provider";
import { FormLabelProvider } from "@/components/form-label-provider";
import { ToastProvider } from "@/components/toast-provider";
import { LanguageProvider } from "@/components/language-provider";
import { getServerLanguage } from "@/lib/i18n-server";

export const metadata: Metadata = {
  title: "St. Austin Teaching Platform",
  description: "Core platform for St. Austin teaching operations.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialLanguage = await getServerLanguage();

  return (
    <html lang={initialLanguage}>
      <body className="antialiased" suppressHydrationWarning>
        <LanguageProvider initialLanguage={initialLanguage}>
          <AppToastProvider>
            <ToastProvider>
              <FormLabelProvider />
              {children}
            </ToastProvider>
          </AppToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
