import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/space-grotesk";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "./globals.css";
import { THEME_BOOT_SCRIPT } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "pixelpunisher.x — turn a bitmap into GitHub contributions",
  description:
    "Design a 53×7 bitmap, connect GitHub, and let an interval painter commit it onto your contribution graph, tick by tick.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased font-display">{children}</body>
    </html>
  );
}
