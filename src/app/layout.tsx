import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import WhatsAppButton from "@/components/WhatsAppButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "Virô — Posição competitiva local para o seu negócio",
  description: "Descubra quantas pessoas no seu mercado ainda não te conhecem. Diagnóstico gratuito em 60 segundos.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "Virô — Posição competitiva local para o seu negócio",
    description: "Descubra quantas pessoas no seu mercado ainda não te conhecem. Diagnóstico gratuito em 60 segundos.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      localization={ptBR}
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
      <html lang="pt-BR" suppressHydrationWarning>
        <head>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "SoftwareApplication",
                "name": "Virô",
                "applicationCategory": "BusinessApplication",
                "description": "Análise de visibilidade e posicionamento digital para negócios locais. Cruza Google, Instagram, IBGE e IA para gerar diagnóstico gratuito em 60 segundos.",
                "operatingSystem": "Web",
                "offers": {
                  "@type": "Offer",
                  "price": "0",
                  "priceCurrency": "BRL",
                  "description": "Diagnóstico gratuito de visibilidade"
                }
              }),
            }}
          />
        </head>
        <body>
          {children}
          <WhatsAppButton />
        </body>
      </html>
    </ClerkProvider>
  );
}
