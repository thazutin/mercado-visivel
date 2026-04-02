import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Serviço — Virô",
  description: "Termos de Serviço da plataforma Virô (Mercado Visível). Condições de uso do diagnóstico de presença digital.",
};

import { V } from "@/lib/design-tokens";

export default function TermosPage() {
  return (
    <main style={{ background: V.white, minHeight: "100vh", fontFamily: V.body, color: V.night }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px 80px" }}>
        <a href="/" style={{ fontSize: 14, color: V.ash, textDecoration: "none", display: "inline-block", marginBottom: 32 }}>
          ← Voltar ao início
        </a>

        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Termos de Serviço</h1>
        <p style={{ fontSize: 14, color: V.ash, marginBottom: 40 }}>Data de vigência: 10 de março de 2026</p>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>1. O que é o Virô</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            O Virô é uma consultoria de inteligência de mercado local. Combinamos dados reais de múltiplas
            fontes — buscas no Google, presença em mapas, redes sociais e visibilidade em ferramentas de IA —
            para entregar diagnósticos precisos sobre onde seu negócio está e onde está a demanda do seu mercado.
            A partir do diagnóstico, o Virô oferece planos de ação personalizados e pode apoiar a execução —
            incluindo a criação de campanhas de mídia paga no Google Ads, com base nos dados e termos
            identificados na análise.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>2. O que entregamos</h2>
          <ul style={{ fontSize: 15, lineHeight: 1.8, color: V.zinc, paddingLeft: 20 }}>
            <li><strong style={{ color: V.night }}>Diagnóstico gratuito de presença digital:</strong> score de influência por canal, comparativo com o mercado local e identificação de lacunas</li>
            <li><strong style={{ color: V.night }}>Diagnóstico completo pago:</strong> análise detalhada por canal (Google, Instagram, IA), dimensionamento de mercado, plano de ação com rotas priorizadas por prazo e esforço</li>
            <li><strong style={{ color: V.night }}>Módulo Google Ads:</strong> criação de rascunhos de campanhas de busca local e campanhas no Google Maps, com base nos termos de maior demanda do diagnóstico, diretamente na conta Google Ads do usuário</li>
          </ul>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>3. Google Ads e execução de campanhas</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            Com autorização explícita do usuário via OAuth 2.0, o Virô utiliza a Google Ads API para criar e
            configurar campanhas de busca local e campanhas no Google Maps. As campanhas são criadas com base
            nos dados do diagnóstico — termos de busca relevantes, geografia de atuação e orçamento mínimo
            sugerido. O usuário mantém controle total: os rascunhos são criados em estado pausado e o usuário
            decide quando e como ativar. O Virô pode, mediante solicitação, acompanhar e otimizar campanhas
            ativas como parte de serviços de consultoria contínua.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>4. Uso aceitável</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            O serviço deve ser utilizado apenas para fins legítimos de negócio. É proibido fornecer informações
            falsas no formulário de diagnóstico, tentar sobrecarregar ou comprometer os sistemas do Virô, e
            revender ou redistribuir os diagnósticos sem autorização.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>5. Pagamento</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            O diagnóstico gratuito não possui custo. O diagnóstico completo tem o valor de{" "}
            <strong style={{ color: V.night }}>R$ 497,00 (quatrocentos e noventa e sete reais)</strong>, em
            pagamento único. Após a entrega do diagnóstico completo,{" "}
            <strong style={{ color: V.night }}>não oferecemos reembolso</strong>, pois o serviço foi
            integralmente prestado. Em caso de falha técnica comprovada que impeça a entrega, o valor será
            restituído integralmente.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>6. Propriedade intelectual</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            O diagnóstico gerado é de propriedade do usuário — você pode usá-lo, compartilhá-lo e apresentá-lo
            como quiser. A metodologia, os modelos de análise e a plataforma Virô são de propriedade exclusiva
            da empresa.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>7. Limitação de responsabilidade</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            Os dados do diagnóstico são baseados em fontes públicas e podem apresentar variações em relação à
            realidade de mercado. O Virô não garante resultados específicos de faturamento, ranking ou captação
            de clientes. As recomendações são baseadas em evidências — a execução e os resultados dependem de
            fatores externos ao controle do Virô.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>8. Lei aplicável</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da Comarca de São Paulo para
            dirimir quaisquer controvérsias.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>9. Contato</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            <a href="mailto:viro@virolocal.com" style={{ color: V.amber, textDecoration: "none" }}>viro@virolocal.com</a>
          </p>
        </section>

        <div style={{ borderTop: `1px solid ${V.fog}`, paddingTop: 24, marginTop: 48 }}>
          <p style={{ fontSize: 13, color: V.ash, lineHeight: 1.6 }}>
            Estes termos podem ser atualizados periodicamente. Quaisquer alterações serão publicadas nesta página com a nova data de vigência.
            O uso continuado da plataforma após alterações constitui aceite dos novos termos.
          </p>
        </div>
      </div>
    </main>
  );
}
