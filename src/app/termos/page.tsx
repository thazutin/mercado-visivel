import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Serviço — Virô",
  description: "Termos de Serviço da plataforma Virô (Mercado Visível). Condições de uso do diagnóstico de presença digital.",
};

const V = {
  night: "#161618",
  zinc: "#6E6E78",
  ash: "#9E9EA8",
  fog: "#EAEAEE",
  white: "#FEFEFF",
  amber: "#CF8523",
  font: "'Satoshi', 'General Sans', -apple-system, sans-serif",
};

export default function TermosPage() {
  return (
    <main style={{ background: V.white, minHeight: "100vh", fontFamily: V.font, color: V.night }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px 80px" }}>
        <a href="/" style={{ fontSize: 14, color: V.ash, textDecoration: "none", display: "inline-block", marginBottom: 32 }}>
          ← Voltar ao início
        </a>

        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Termos de Serviço</h1>
        <p style={{ fontSize: 14, color: V.ash, marginBottom: 40 }}>Data de vigência: 10 de março de 2026</p>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>1. O que é o Virô</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            O <strong style={{ color: V.night }}>Virô</strong> (operado sob a marca "Mercado Visível") é uma plataforma de inteligência de mercado local
            que gera diagnósticos de presença digital para empresas. Nosso serviço analisa a visibilidade do seu negócio em buscas do Google,
            Google Maps, Instagram e outras fontes públicas, entregando um relatório com dados de mercado, análise de concorrência
            e um plano de ação personalizado.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>2. O que não somos</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            O Virô é uma ferramenta de inteligência e diagnóstico. <strong style={{ color: V.night }}>Não somos uma agência de marketing,
            não gerenciamos campanhas de anúncios, não operamos contas de Google Ads ou Meta Ads em nome de terceiros,
            e não garantimos resultados específicos</strong> (como aumento de faturamento, ranking ou número de clientes).
            O diagnóstico é uma fotografia analítica do seu mercado — a execução das recomendações é de responsabilidade do usuário.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>3. Uso aceitável</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            O serviço deve ser utilizado apenas para fins legítimos de negócio. É proibido:
          </p>
          <ul style={{ fontSize: 15, lineHeight: 1.8, color: V.zinc, paddingLeft: 20 }}>
            <li>Usar o Virô para coletar dados de concorrentes com fins anticompetitivos ou ilegais.</li>
            <li>Fornecer informações falsas no formulário de diagnóstico.</li>
            <li>Tentar acessar, sobrecarregar ou comprometer nossos sistemas ou APIs.</li>
            <li>Revender, redistribuir ou sublicenciar o acesso à plataforma sem autorização.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>4. Pagamento</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            O diagnóstico completo do Virô tem o valor de <strong style={{ color: V.night }}>R$ 397,00 (trezentos e noventa e sete reais)</strong>,
            em pagamento único. O diagnóstico gratuito (prévia) não possui custo. Após a entrega do diagnóstico completo,
            <strong style={{ color: V.night }}> não oferecemos reembolso</strong>, pois o serviço já foi integralmente prestado
            (geração do relatório com dados em tempo real). Em caso de falha técnica comprovada que impeça a entrega do diagnóstico,
            o valor será restituído integralmente.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>5. Propriedade intelectual</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            O diagnóstico gerado é de propriedade do usuário — você pode usá-lo, compartilhá-lo e apresentá-lo como quiser.
            A metodologia de análise, os modelos de scoring, a interface e o código da plataforma são propriedade intelectual do Virô
            e não podem ser copiados, reproduzidos ou engenharia-reversa.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>6. Limitação de responsabilidade</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            Os dados apresentados no diagnóstico são baseados em fontes públicas (Google, Instagram, bases de dados de busca)
            e modelos estatísticos. <strong style={{ color: V.night }}>Esses dados podem apresentar variações em relação à realidade</strong>,
            pois dependem da disponibilidade e atualização das fontes no momento da análise. O Virô não se responsabiliza por
            decisões de negócio tomadas exclusivamente com base no diagnóstico. Recomendamos que o relatório seja utilizado como
            uma das fontes de informação para a tomada de decisão, e não como a única.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>7. Lei aplicável e foro</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            Estes Termos de Serviço são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da Comarca de
            São Paulo, Estado de São Paulo, para dirimir quaisquer controvérsias decorrentes destes termos, com renúncia a
            qualquer outro, por mais privilegiado que seja.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>8. Contato</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            Para dúvidas sobre estes Termos de Serviço, entre em contato pelo e-mail{" "}
            <a href="mailto:contato@virolocal.com" style={{ color: V.amber, textDecoration: "none" }}>contato@virolocal.com</a>.
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
