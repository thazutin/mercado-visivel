import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Virô — Seu mercado, visível.",
  description: "Quanto do seu mercado local te conhece? Análise real de demanda, concorrência e posicionamento. Grátis. 30 segundos.",
  openGraph: {
    title: "Virô — Seu mercado, visível.",
    description: "Análise real de demanda, concorrência e posicionamento para empresas locais. Grátis.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="pt-BR" suppressHydrationWarning>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
