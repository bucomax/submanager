import { SpeedInsights } from "@vercel/speed-insights/next";
import { routing } from "@/i18n/routing";
import { AuthSessionProvider } from "@/shared/components/providers/session-provider";
import { ThemeBlockingScript } from "@/shared/components/providers/theme-blocking-script";
import { LocalePreferenceBridge } from "@/shared/components/providers/locale-preference-bridge";
import { ThemeProvider } from "@/shared/components/providers/theme-provider";
import { Toaster } from "@/shared/components/ui/sonner";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Geist_Mono, Outfit } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "global" });
  return {
    title: t("meta.title"),
    description: t("meta.description"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as "en" | "pt-BR")) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${outfit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <ThemeBlockingScript />
      </head>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider key={locale} locale={locale} messages={messages}>
          <AuthSessionProvider>
            <ThemeProvider>
              <TooltipProvider>
                <LocalePreferenceBridge />
                {children}
                <Toaster position="top-right" richColors closeButton />
                {/* Só existe na Vercel: no Cloud Run o script /_vercel/speed-insights responde 404. */}
                {process.env.VERCEL ? <SpeedInsights /> : null}
              </TooltipProvider>
            </ThemeProvider>
          </AuthSessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
