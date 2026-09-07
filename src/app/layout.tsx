import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "CS2KZ Viewer",
  description: "Fast, modern CS2KZ dashboard and leaderboards viewer.",
  icons: {
    icon: "/kz-logo.png",
    shortcut: "/kz-logo.png",
    apple: "/kz-logo.png",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
