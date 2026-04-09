import type { Metadata } from "next";
import type { JSX, ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AppProviders } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aegis Dashboard",
  description: "Household-first maintenance tracking for vehicles, homes, tools, and equipment."
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>): Promise<JSX.Element> {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}