import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mercado Visível — Marketing com clareza para negócios locais",
  description:
    "Veja o tamanho do mercado ao redor do seu negócio. Análise real de demanda, concorrência e posicionamento. Gratuito.",
  openGraph: {
    title: "Mercado Visível",
    description: "Quanto do seu mercado local te conhece? Descubra em 30 segundos.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="pt-BR" suppressHydrationWarning>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
