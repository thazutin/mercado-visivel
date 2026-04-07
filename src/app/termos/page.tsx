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
        <p style={{ fontSize: 14, color: V.ash, marginBottom: 40 }}>Data de vigência: 7 de abril de 2026</p>

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
            <li><strong style={{ color: V.night }}>Módulo Google Business Profile (Agente Nelson para o Google Meu Negócio):</strong> após conexão via OAuth, o Virô executa, com aprovação do dono do negócio, ações no Perfil de Empresa do Google — publicação de Google Posts, resposta a avaliações e otimização da ficha (descrição, atributos, categorias, fotos, horários). Inclui janela de 30 dias de operação inclusa no diagnóstico completo pago.</li>
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
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>3.1. Google Business Profile (Google Meu Negócio) e execução de ações</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc, marginBottom: 12 }}>
            O módulo de Google Business Profile (também referido como "Agente Nelson para Google Meu Negócio")
            só é ativado após conexão explícita do usuário ao seu Perfil de Empresa via OAuth 2.0, com escopo{" "}
            <code>https://www.googleapis.com/auth/business.manage</code>. Após a conexão, o Virô pode realizar
            as seguintes categorias de ações na ficha do negócio do usuário:
          </p>
          <ul style={{ fontSize: 15, lineHeight: 1.8, color: V.zinc, paddingLeft: 20, marginBottom: 12 }}>
            <li>Criar e publicar Google Posts (novidades, ofertas, eventos)</li>
            <li>Gerar e publicar respostas a avaliações de clientes</li>
            <li>Sugerir e aplicar atualizações em descrição, atributos, categorias, serviços, fotos e horários</li>
            <li>Responder perguntas (Q&A) recebidas pela ficha</li>
          </ul>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc, marginBottom: 12 }}>
            <strong style={{ color: V.night }}>Aprovação do dono do negócio:</strong> por padrão, toda ação
            requer aprovação humana antes de ser publicada. O usuário pode opcionalmente configurar regras de
            auto-publicação para categorias específicas (por exemplo, "responder automaticamente avaliações
            5 estrelas"), e essas regras podem ser desativadas a qualquer momento. Toda ação executada é
            registrada em log auditável e pode ser revertida pelo usuário.
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc, marginBottom: 12 }}>
            <strong style={{ color: V.night }}>Janela inclusa no diagnóstico pago:</strong> a contratação do
            diagnóstico completo (R$497) inclui 30 dias corridos de operação do agente Google Business Profile,
            contados a partir da conexão da ficha. Após esse período, o agente é pausado. A continuidade da
            operação ocorre por meio da assinatura mensal Virô (R$99/mês), que pode ser ativada a qualquer
            momento durante ou após a janela inicial.
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: V.zinc }}>
            <strong style={{ color: V.night }}>Limites de atuação:</strong> o Virô não modifica nome do negócio,
            não transfere propriedade de fichas, não acessa faturamento, não publica conteúdo enganoso, não
            responde a avaliações em nome do dono em situações de conflito sério (essas são escaladas para o
            usuário), e não realiza nenhuma ação que viole as{" "}
            <a href="https://support.google.com/business/answer/3038177" style={{ color: V.amber, textDecoration: "none" }}>
              Diretrizes de Representação de Empresas no Google
            </a>. O usuário pode revogar o acesso a qualquer momento em{" "}
            <a href="https://myaccount.google.com/permissions" style={{ color: V.amber, textDecoration: "none" }}>
              myaccount.google.com/permissions
            </a>, o que pausa imediatamente toda a operação automatizada.
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
