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
        <p style={{ fontSize: 14, color: V.ash, marginBottom: 40 }}>Data de vigência: 7 de abril de 2026</p>

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
            WhatsApp e endereço de e-mail. Caso você utilize os módulos opcionais de Google Ads ou{" "}
            <strong style={{ color: V.night }}>Google Business Profile</strong>, solicitamos autorização de
            acesso à sua respectiva conta via OAuth 2.0 — não armazenamos sua senha nem credenciais de acesso,
            apenas os tokens de acesso necessários, criptografados, e revogáveis a qualquer momento.
          </p>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>3. Como usamos seus dados</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            Seus dados são utilizados exclusivamente para gerar o diagnóstico de mercado, enviar os resultados
            por e-mail e WhatsApp, e, se autorizado, criar rascunhos de campanhas na sua conta Google Ads e
            executar ações aprovadas por você no seu Perfil de Empresa do Google (Google Business Profile).{" "}
            <strong style={{ color: V.night }}>Nunca vendemos, alugamos ou compartilhamos seus dados com
            terceiros para fins comerciais.</strong> Os dados obtidos via APIs Google (incluindo Google
            Business Profile) são usados em conformidade com a{" "}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" style={{ color: V.amber, textDecoration: "none" }}>
              Google API Services User Data Policy
            </a>, incluindo os requisitos de Limited Use.
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
            <li><strong style={{ color: V.night }}>Google Business Profile API (Google Meu Negócio)</strong> — utilizada exclusivamente quando o usuário conecta seu Perfil de Empresa no Google via OAuth 2.0, com escopo <code>business.manage</code>. Após a conexão, o Virô pode, sempre com aprovação explícita do dono do negócio (ou conforme regras de auto-publicação que ele mesmo configurar): (i) criar e publicar Google Posts na ficha do negócio; (ii) gerar e publicar respostas a avaliações de clientes; (iii) sugerir e aplicar otimizações na descrição, atributos, categorias, serviços, fotos e horários do perfil. Não modificamos nome do negócio, propriedade da ficha, faturamento ou qualquer configuração sensível. Cada ação é registrada em log auditável e é reversível. O usuário pode revogar o acesso a qualquer momento em <a href="https://myaccount.google.com/permissions" style={{ color: V.amber, textDecoration: "none" }}>myaccount.google.com/permissions</a>, o que interrompe imediatamente toda a operação automatizada do Virô sobre sua ficha. Não compartilhamos nem agregamos dados do seu Perfil de Empresa com terceiros.</li>
            <li><strong style={{ color: V.night }}>Instagram</strong> — coletamos apenas dados públicos do perfil informado: número de seguidores, frequência de publicações e métricas de engajamento público.</li>
            <li><strong style={{ color: V.night }}>Perplexity AI</strong> — utilizada para verificar se o negócio aparece em respostas de ferramentas de inteligência artificial para buscas locais.</li>
            <li><strong style={{ color: V.night }}>DataForSEO</strong> — utilizada para análise de volume de busca e presença orgânica nos resultados do Google.</li>
            <li><strong style={{ color: V.night }}>CNPJá e dados públicos da Receita Federal</strong> — utilizados para identificar empresas brasileiras por CNAE e localização, para clientes com perfil B2B que desejam mapear potenciais compradores. São coletados apenas dados cadastrais públicos (razão social, CNPJ, porte, endereço, CNAE, email e telefone institucional quando disponíveis no registro público).</li>
            <li><strong style={{ color: V.night }}>Hunter.io</strong> — utilizado exclusivamente para leads com perfil B2B, para identificar contatos profissionais (nome, cargo e email corporativo) de decisores em empresas-alvo a partir do domínio corporativo. Os dados retornados são agregados pelo Hunter.io a partir de fontes públicas na web (sites corporativos, assinaturas de email públicas, perfis profissionais abertos). Esses contatos são exibidos apenas dentro do painel do próprio cliente Virô, como parte do seu plano de prospecção B2B, e nunca são compartilhados entre clientes diferentes ou agregados em bases próprias. Qualquer pessoa cujos dados apareçam nesse fluxo pode solicitar remoção direta ao Hunter.io em <a href="https://hunter.io/claims" style={{ color: V.amber, textDecoration: "none" }}>hunter.io/claims</a>.</li>
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
