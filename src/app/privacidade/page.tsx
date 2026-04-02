import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade — Virô",
  description: "Política de Privacidade da plataforma Virô (Mercado Visível). Saiba como coletamos, usamos e protegemos seus dados.",
};

import { V } from "@/lib/design-tokens";

export default function PrivacidadePage() {
  return (
    <main style={{ background: V.white, minHeight: "100vh", fontFamily: V.body, color: V.night }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px 80px" }}>
        <a href="/" style={{ fontSize: 14, color: V.ash, textDecoration: "none", display: "inline-block", marginBottom: 32 }}>
          ← Voltar ao início
        </a>

        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Política de Privacidade</h1>
        <p style={{ fontSize: 14, color: V.ash, marginBottom: 40 }}>Data de vigência: 10 de março de 2026</p>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>1. Quem somos</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            O Virô é uma consultoria de inteligência de mercado local, acessível em virolocal.com. Ajudamos
            pequenos e médios negócios a entender sua presença digital e a tomar decisões de marketing com
            base em dados reais.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>2. Quais dados coletamos</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            Ao utilizar o Virô, coletamos as informações fornecidas diretamente por você no formulário de
            diagnóstico: nome do negócio, segmento de atuação, região, endereço de Instagram, número de
            WhatsApp e endereço de e-mail. Caso você utilize o módulo Google Ads, solicitamos autorização de
            acesso à sua conta via OAuth 2.0 — não armazenamos sua senha nem credenciais de acesso.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>3. Como usamos seus dados</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            Seus dados são utilizados exclusivamente para gerar o diagnóstico de mercado, enviar os resultados
            por e-mail e WhatsApp, e, se autorizado, criar rascunhos de campanhas na sua conta Google Ads.{" "}
            <strong style={{ color: V.night }}>Nunca vendemos, alugamos ou compartilhamos seus dados com
            terceiros para fins comerciais.</strong>
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>4. APIs e serviços de terceiros</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc, marginBottom: 12 }}>
            Para gerar o diagnóstico, o Virô utiliza as seguintes APIs externas:
          </p>
          <ul style={{ fontSize: 15, lineHeight: 1.8, color: V.zinc, paddingLeft: 20 }}>
            <li><strong style={{ color: V.night }}>Google Places API e Google Search</strong> — utilizadas para verificar presença do negócio no Google Maps e analisar resultados de busca locais.</li>
            <li><strong style={{ color: V.night }}>Google Ads API</strong> — utilizada, com autorização explícita do usuário via OAuth 2.0, para criar campanhas de busca local e campanhas no Google Maps com base nos dados do diagnóstico. O Virô cria rascunhos de campanhas em estado pausado na conta do usuário. O usuário mantém controle total sobre ativação, orçamento e veiculação. Não acessamos campanhas existentes sem solicitação, não realizamos lances automáticos e não armazenamos dados de desempenho de campanhas.</li>
            <li><strong style={{ color: V.night }}>Instagram</strong> — coletamos apenas dados públicos do perfil informado: número de seguidores, frequência de publicações e métricas de engajamento público.</li>
            <li><strong style={{ color: V.night }}>Perplexity AI</strong> — utilizada para verificar se o negócio aparece em respostas de ferramentas de inteligência artificial para buscas locais.</li>
            <li><strong style={{ color: V.night }}>DataForSEO</strong> — utilizada para análise de volume de busca e presença orgânica nos resultados do Google.</li>
          </ul>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc, marginTop: 12 }}>
            Nenhum desses serviços recebe dados pessoais seus além do estritamente necessário para executar a consulta.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>5. Retenção de dados</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            Mantemos seus dados por até 2 anos a partir da data do diagnóstico. Após esse período, os dados
            são excluídos automaticamente. Você pode solicitar a exclusão antecipada a qualquer momento.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>6. Seus direitos (LGPD)</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            Em conformidade com a Lei Geral de Proteção de Dados, você tem direito a acessar, corrigir ou
            solicitar a exclusão dos seus dados. Para exercer qualquer um desses direitos, entre em contato
            pelo e-mail{" "}
            <a href="mailto:viro@virolocal.com" style={{ color: V.amber, textDecoration: "none" }}>viro@virolocal.com</a>.
            Respondemos em até 15 dias úteis.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>7. Cookies</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            O Virô utiliza apenas cookies de sessão necessários para autenticação. Não utilizamos cookies de
            rastreamento, remarketing ou publicidade.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>8. Contato</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            <a href="mailto:viro@virolocal.com" style={{ color: V.amber, textDecoration: "none" }}>viro@virolocal.com</a>
          </p>
        </section>

        <div style={{ borderTop: `1px solid ${V.fog}`, paddingTop: 24, marginTop: 48 }}>
          <p style={{ fontSize: 13, color: V.ash, lineHeight: 1.6 }}>
            Esta política pode ser atualizada periodicamente. Quaisquer alterações serão publicadas nesta página com a nova data de vigência.
          </p>
        </div>
      </div>
    </main>
  );
}
