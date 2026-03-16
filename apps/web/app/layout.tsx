import type { Metadata } from "next";
import type { JSX, ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AssetKeeper Dashboard",
  description: "Household-first maintenance tracking for vehicles, homes, tools, and equipment."
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>): Promise<JSX.Element> {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}