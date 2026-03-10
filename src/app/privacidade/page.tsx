import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade — Virô",
  description: "Política de Privacidade da plataforma Virô (Mercado Visível). Saiba como coletamos, usamos e protegemos seus dados.",
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

export default function PrivacidadePage() {
  return (
    <main style={{ background: V.white, minHeight: "100vh", fontFamily: V.font, color: V.night }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px 80px" }}>
        <a href="/" style={{ fontSize: 14, color: V.ash, textDecoration: "none", display: "inline-block", marginBottom: 32 }}>
          ← Voltar ao início
        </a>

        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Política de Privacidade</h1>
        <p style={{ fontSize: 14, color: V.ash, marginBottom: 40 }}>Data de vigência: 10 de março de 2026</p>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>1. Quem somos</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            O <strong style={{ color: V.night }}>Virô</strong> (operado sob a marca "Mercado Visível") é uma plataforma de inteligência de mercado local.
            Ajudamos empresas a entenderem sua visibilidade digital — quão encontráveis elas são por potenciais clientes na sua região.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>2. Quais dados coletamos</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc, marginBottom: 12 }}>
            Para gerar o diagnóstico de presença digital, coletamos as seguintes informações fornecidas diretamente por você:
          </p>
          <ul style={{ fontSize: 15, lineHeight: 1.8, color: V.zinc, paddingLeft: 20 }}>
            <li>Nome do negócio</li>
            <li>Segmento de atuação</li>
            <li>Região / localização</li>
            <li>Perfil do Instagram (se fornecido)</li>
            <li>Número de WhatsApp</li>
            <li>Endereço de e-mail</li>
          </ul>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>3. Como usamos seus dados</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            Utilizamos seus dados exclusivamente para gerar o diagnóstico de presença digital do seu negócio e para comunicação
            relacionada ao serviço (envio de resultados, atualizações relevantes). <strong style={{ color: V.night }}>Nunca
            revendemos, compartilhamos ou cedemos seus dados pessoais a terceiros para fins de marketing.</strong>
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>4. APIs e serviços de terceiros</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc, marginBottom: 12 }}>
            Para compor a análise de mercado, o Virô se integra aos seguintes serviços:
          </p>
          <ul style={{ fontSize: 15, lineHeight: 1.8, color: V.zinc, paddingLeft: 20 }}>
            <li><strong style={{ color: V.night }}>Google (Places API e Search)</strong> — Dados de localização, avaliações públicas e resultados de busca orgânica relacionados ao seu segmento e região.</li>
            <li><strong style={{ color: V.night }}>Google Ads API</strong> — Utilizada para criar rascunhos de campanhas de busca e campanhas locais (Google Maps) diretamente na conta Google Ads do usuário, com base nos dados do diagnóstico de mercado. O Virô solicita autorização explícita do usuário via OAuth antes de acessar qualquer conta. Não acessamos campanhas existentes sem permissão, não fazemos alterações automáticas, e não armazenamos credenciais de acesso às contas Google Ads dos usuários.</li>
            <li><strong style={{ color: V.night }}>Instagram</strong> — Coletamos apenas dados públicos do perfil informado (número de seguidores, frequência de publicações, engajamento público).</li>
            <li><strong style={{ color: V.night }}>Perplexity AI</strong> — Utilizada para enriquecer a análise com informações contextuais sobre o mercado e segmento.</li>
            <li><strong style={{ color: V.night }}>DataForSEO</strong> — Dados complementares de volume de busca, presença orgânica e métricas de mercado digital.</li>
          </ul>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc, marginTop: 12 }}>
            Nenhum desses serviços recebe dados pessoais seus além do estritamente necessário para executar a consulta (ex: nome do negócio e região para buscar dados públicos).
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>5. Retenção de dados</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            Mantemos seus dados por até 2 (dois) anos a partir da data do diagnóstico, com o objetivo de permitir análises de
            tendências e comparações históricas para o seu negócio. Após esse período, os dados são excluídos automaticamente
            de nossos sistemas.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>6. Seus direitos</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            Em conformidade com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:
          </p>
          <ul style={{ fontSize: 15, lineHeight: 1.8, color: V.zinc, paddingLeft: 20 }}>
            <li><strong style={{ color: V.night }}>Acesso</strong> — Solicitar uma cópia dos dados que temos sobre você.</li>
            <li><strong style={{ color: V.night }}>Correção</strong> — Solicitar a correção de dados incorretos ou desatualizados.</li>
            <li><strong style={{ color: V.night }}>Exclusão</strong> — Solicitar a exclusão completa dos seus dados de nossos sistemas.</li>
          </ul>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc, marginTop: 12 }}>
            Para exercer qualquer um desses direitos, entre em contato pelo e-mail{" "}
            <a href="mailto:viro@virolocal.com" style={{ color: V.amber, textDecoration: "none" }}>viro@virolocal.com</a>.
            Responderemos em até 15 dias úteis.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>7. Cookies</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            O Virô utiliza apenas cookies de sessão, necessários para o funcionamento da autenticação (via Clerk).
            Não utilizamos cookies de rastreamento, remarketing ou publicidade. Não integramos ferramentas de analytics
            que depositem cookies de terceiros no seu navegador.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>8. Contato</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            Para dúvidas, solicitações ou esclarecimentos sobre esta Política de Privacidade, entre em contato pelo e-mail{" "}
            <a href="mailto:viro@virolocal.com" style={{ color: V.amber, textDecoration: "none" }}>viro@virolocal.com</a>.
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
