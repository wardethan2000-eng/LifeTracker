import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

const localeCookieName = "NEXT_LOCALE";
const supportedLocales = ["en"] as const;
const defaultLocale = "en";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requestedLocale = cookieStore.get(localeCookieName)?.value;
  const locale: string = supportedLocales.includes(requestedLocale as (typeof supportedLocales)[number])
    ? requestedLocale as string
    : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});