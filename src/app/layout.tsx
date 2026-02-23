import type { Metadata } from "next";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
