import type { Metadata } from "next";
import "./globals.css";
import { AppToastProvider } from "@/components/app-toast-provider";
import { FormLabelProvider } from "@/components/form-label-provider";
import { ToastProvider } from "@/components/toast-provider";
import { LanguageProvider } from "@/components/language-provider";

export const metadata: Metadata = {
  title: "St. Austin Teaching Platform",
  description: "Core platform for St. Austin teaching operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased" suppressHydrationWarning>
        <LanguageProvider>
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
