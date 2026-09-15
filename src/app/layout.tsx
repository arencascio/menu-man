import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AnalyticsScripts from "./AnalyticsScripts";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Menu Man | Restaurant Websites Built & Managed for You",
    template: "%s | Menu Man",
  },
  description:
    "Menu Man builds and manages modern websites for restaurants, including menus, routine updates, online ordering options, and reporting.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <AnalyticsScripts />
      </body>
    </html>
  );
}
