import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR, enUS, esES } from "@clerk/localizations";
import WhatsAppButton from "@/components/WhatsAppButton";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n-config";
import type { Locale } from "@/lib/i18n";
import "./globals.css";

const CLERK_LOCALIZATIONS: Record<Locale, any> = {
  pt: ptBR,
  en: enUS,
  es: esES,
};

const LANG_MAP: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en",
  es: "es",
};

export const metadata: Metadata = {
  title: "Virô — Seu mercado, visível.",
  description: "Quanto do seu mercado local te conhece? Análise real de demanda, concorrência e posicionamento. Grátis. 30 segundos.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Virô — Seu mercado, visível.",
    description: "Análise real de demanda, concorrência e posicionamento para empresas locais. Grátis.",
    type: "website",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE_NAME)?.value || "pt") as Locale;
  const validLocale = ["pt", "en", "es"].includes(locale) ? locale : "pt";

  return (
    <ClerkProvider
      localization={CLERK_LOCALIZATIONS[validLocale]}
      appearance={{
        variables: {
          colorPrimary: "#161618",
          colorTextOnPrimaryBackground: "#FEFEFF",
          colorBackground: "#FEFEFF",
          colorInputBackground: "#F4F4F7",
          colorInputText: "#161618",
          borderRadius: "10px",
          fontFamily: "'Satoshi', 'General Sans', -apple-system, sans-serif",
        },
        elements: {
          card: { boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
          formButtonPrimary: {
            backgroundColor: "#161618",
            "&:hover": { backgroundColor: "#3A3A40" },
          },
        },
      }}
    >
      <html lang={LANG_MAP[validLocale]} suppressHydrationWarning>
        <body>
          {children}
          <WhatsAppButton />
        </body>
      </html>
    </ClerkProvider>
  );
}
