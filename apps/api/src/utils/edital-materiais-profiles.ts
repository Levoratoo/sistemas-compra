/**
 * Perfis de âncora para extração da lista de materiais em editais / TR.
 * Ordem em {@link EDITAL_MATERIAIS_PROFILE_ORDER}: primeiro match vence (detecção automática).
 *
 * Paraná (CONSAMU / pregão oeste PR): seção 7 "MATERIAIS A SEREM DISPONIBILIZADOS".
 * Roraima (EBSERH / HU-UFRR e similares): variações comuns com vírgula ("MATERIAIS, EQUIPAMENTOS")
 * ou "RELACAO DE MATERIAIS" em anexo — ajustar regex após validar PDF real.
 * Roraima TR (tabelas TIPO/QTD + ESPECIFICAÇÃO, uniformes por função — págs. típicas 46+).
 */
export type EditalMateriaisProfile = {
  id: 'parana' | 'roraima' | 'roraima_tr_tabelas';
  /** Rótulo para logs / previewJson */
  label: string;
  /** Âncora principal (primeira tentativa) */
  anchorMain: RegExp;
  /** Âncora secundária se a principal não existir (ex.: subseção ou título alternativo) */
  anchorSub: RegExp;
  /**
   * Fim do bloco da tabela: evitar engolir capítulo seguinte.
   * Paraná: 8. DISPOS…; genérico: ANEXO / CAPÍTULO.
   */
  sectionStop: RegExp;
  /** Grupo exibido na revisão de extração */
  recordGroup: string;
  /** Campo `source` no JSON do payload da linha */
  payloadSource: string;
};

/** CONSAMU / editais com a mesma redação da seção 7. */
const PARANA: EditalMateriaisProfile = {
  id: 'parana',
  label: 'Paraná (CONSAMU / pregão oeste PR)',
  anchorMain: /(?:^|\n|\r)\s*7\s*[\.\)]?\s*MATERIAIS\s+A\s+SEREM\s+DISPONIBILIZADOS\b/i,
  anchorSub:
    /MATERIAIS\s+A\s+SEREM\s+DISPONIBILIZADOS\s+PARA\s+SERVI[CÇ]OS\s+DE\s+MANUTEN[CÇ][AÃ]O\s+PREDIAL/i,
  sectionStop:
    /\n\s*(?:8\s*[\.\)]\s*DISPOS|8\s+DISPOSI[CÇ]|ANEXO\s+[IVXLCDM0-9]+|CAP[ÍI]TULO\s+\d+)/i,
  recordGroup: '7. Materiais a disponibilizar (edital)',
  payloadSource: 'edital_secao_7',
};

/**
 * HU-UFRR / EBSERH: títulos frequentes com vírgula ou "relação" no anexo.
 * Não deve coincidir com o perfil Paraná (texto distinto após "7.").
 */
const RORAIMA: EditalMateriaisProfile = {
  id: 'roraima',
  label: 'Roraima (EBSERH / HU-UFRR e similares)',
  anchorMain: /(?:^|\n|\r)\s*7\s*[\.\)]?\s*MATERIAIS\s*,\s*EQUIPAMENTOS\b/i,
  anchorSub: /(?:^|\n)\s*RELAC[AÃ]O\s+DE\s+MATERIAIS\b/i,
  sectionStop:
    /\n\s*(?:8\s*[\.\)]\s*DISPOS|8\s+DISPOSI[CÇ]|8\s+UNIFORMES\b|ANEXO\s+[IVXLCDM0-9]+|CAP[ÍI]TULO\s+\d+)/i,
  recordGroup: '7. Materiais a disponibilizar (edital — Roraima)',
  payloadSource: 'edital_secao_7_roraima',
};

/**
 * TR HU-UFRR / Roraima: tabelas com cabeçalhos TIPO/QTD e ESPECIFICAÇÃO (sem coluna ITEM 1,2,3…).
 * Âncora na primeira ocorrência do cabeçalho da tabela ou em SOLUÇÃO ÚNICA.
 * Não usar como fim do bloco "8 UNIFORMES" (o conteúdo pode estar dentro do cap. 8).
 */
const RORAIMA_TR_TABELAS: EditalMateriaisProfile = {
  id: 'roraima_tr_tabelas',
  label: 'Roraima TR — TIPO/QTD + ESPECIFICAÇÃO (uniformes)',
  /** PDFs podem perder a barra no texto copiado. */
  anchorMain: /\b(?:TIPO\s*\/\s*QTD|TIPO\s+QTD)\b/i,
  anchorSub: /\bSOLU[CÇ][AÃ]O\s+[ÚU]NICA\b/i,
  sectionStop:
    /\n\s*(?:9\s+MODELO\s+DE\s+GEST|9\s*\.\s*MODELO|MODELO\s+DE\s+GEST[AÃ]O\s+DO\s+CONTRATO|CAP[ÍI]TULO\s+9\b|9\s+DO\s+OBJETO)/i,
  recordGroup: 'TR — Uniformes (TIPO/QTD — Roraima)',
  payloadSource: 'edital_tr_tipo_qtd_roraima',
};

export const EDITAL_MATERIAIS_PROFILE_ORDER: EditalMateriaisProfile[] = [
  PARANA,
  RORAIMA_TR_TABELAS,
  RORAIMA,
];
