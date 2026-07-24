import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "@/components/providers/posthog-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Genvora",
  description: "AI visibility audits for teams shipping modern websites.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
