import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
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

const bricolage = localFont({
  src: "./fonts/BricolageGrotesque-Variable.ttf",
  variable: "--font-menu-man-display",
  display: "swap",
});

const manrope = localFont({
  src: "./fonts/Manrope-Variable.ttf",
  variable: "--font-menu-man-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Menu Man | Restaurant Websites Built & Managed for You",
    template: "%s | Menu Man",
  },
  description:
    "Menu Man builds and manages restaurant websites with searchable menus, clear ordering paths, practical details, and ongoing updates.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} ${manrope.variable}`}>
      <body>
        {children}
        <AnalyticsScripts />
      </body>
    </html>
  );
}
