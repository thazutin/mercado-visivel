// ============================================================================
// PNCP — Portal Nacional de Contratações Públicas
// Consulta licitações e contratos públicos para negócios B2G
// API: https://pncp.gov.br/api/pncp/v1
// ============================================================================

export interface PNCPContratacao {
  numeroContratacao: string;
  objeto: string;
  orgaoEntidade: string;
  uf: string;
  modalidade: string;
  valorEstimado: number;
  dataPublicacao: string;
  situacao: string;
}

export interface PNCPResumo {
  totalEncontradas: number;
  contratacoes: PNCPContratacao[];
  valorTotalEstimado: number;
  modalidades: { modalidade: string; count: number }[];
  orgaosUnicos: number;
  periodoConsultado: string;
}

/**
 * Busca contratações públicas no PNCP relacionadas ao segmento do negócio.
 * Retorna até 20 resultados mais recentes.
 * Timeout: 10s, falha silenciosa retornando null.
 */
export async function buscarContratacoesPNCP(
  produto: string,
  uf?: string,
): Promise<PNCPResumo | null> {
  try {
    // Monta query de busca — simplifica o produto para termos de licitação
    const query = encodeURIComponent(produto.slice(0, 100));

    // Data de 6 meses atrás
    const dataInicio = new Date();
    dataInicio.setMonth(dataInicio.getMonth() - 6);
    const dataInicioStr = dataInicio.toISOString().split('T')[0];
    const dataFimStr = new Date().toISOString().split('T')[0];

    let url = `https://pncp.gov.br/api/pncp/v1/orgaos/contratacoes/publicacoes?q=${query}&dataInicial=${dataInicioStr}&dataFinal=${dataFimStr}&pagina=1&tamanhoPagina=20`;
    if (uf) {
      url += `&uf=${uf}`;
    }

    console.log(`[PNCP] Buscando: produto="${produto}", uf=${uf || 'todos'}`);

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ViroLocal/1.0',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[PNCP] HTTP ${res.status}: ${await res.text().then(t => t.slice(0, 200)).catch(() => 'no body')}`);
      return null;
    }

    const data = await res.json();

    // A API retorna um array de contratações ou objeto paginado
    const items: any[] = Array.isArray(data) ? data : (data.data || data.contratacoes || []);

    if (items.length === 0) {
      console.log(`[PNCP] Nenhuma contratação encontrada para "${produto}"`);
      return { totalEncontradas: 0, contratacoes: [], valorTotalEstimado: 0, modalidades: [], orgaosUnicos: 0, periodoConsultado: `${dataInicioStr} a ${dataFimStr}` };
    }

    const contratacoes: PNCPContratacao[] = items.map((item: any) => ({
      numeroContratacao: item.numeroContratacao || item.numero || '',
      objeto: (item.objetoContratacao || item.objeto || '').slice(0, 200),
      orgaoEntidade: item.orgaoEntidade?.razaoSocial || item.orgao || '',
      uf: item.orgaoEntidade?.uf || item.uf || uf || '',
      modalidade: item.modalidadeNome || item.modalidade || '',
      valorEstimado: parseFloat(item.valorTotalEstimado || item.valor || '0') || 0,
      dataPublicacao: item.dataPublicacaoPncp || item.dataPublicacao || '',
      situacao: item.situacaoCompra || item.situacao || '',
    }));

    // Agrupa modalidades
    const modalidadeMap = new Map<string, number>();
    for (const c of contratacoes) {
      if (c.modalidade) {
        modalidadeMap.set(c.modalidade, (modalidadeMap.get(c.modalidade) || 0) + 1);
      }
    }
    const modalidades = Array.from(modalidadeMap.entries())
      .map(([modalidade, count]) => ({ modalidade, count }))
      .sort((a, b) => b.count - a.count);

    const orgaosUnicos = new Set(contratacoes.map(c => c.orgaoEntidade).filter(Boolean)).size;
    const valorTotalEstimado = contratacoes.reduce((sum, c) => sum + c.valorEstimado, 0);

    console.log(`[PNCP] ${contratacoes.length} contratações, ${orgaosUnicos} órgãos, R$${(valorTotalEstimado / 1000).toFixed(0)}k total`);

    return {
      totalEncontradas: data.totalRegistros || contratacoes.length,
      contratacoes: contratacoes.slice(0, 10), // limita para display
      valorTotalEstimado,
      modalidades,
      orgaosUnicos,
      periodoConsultado: `${dataInicioStr} a ${dataFimStr}`,
    };
  } catch (err) {
    if ((err as Error).name === 'AbortError' || (err as Error).name === 'TimeoutError') {
      console.warn('[PNCP] Timeout (10s)');
    } else {
      console.warn('[PNCP] Erro:', (err as Error).message);
    }
    return null;
  }
}
