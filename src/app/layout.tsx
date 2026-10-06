import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });

export const metadata: Metadata = {
  title: "Collaktiv CRM",
  description: "Partnerförsäljning för Collaktiv i Gävleborg",
  appleWebApp: { capable: true, title: "Collaktiv CRM", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#166849",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" className={montserrat.variable}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
