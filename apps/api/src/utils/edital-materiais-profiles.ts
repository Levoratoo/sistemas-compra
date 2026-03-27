/**
 * Perfis de âncora para extração da lista de materiais em editais / TR.
 * Ordem em {@link EDITAL_MATERIAIS_PROFILE_ORDER}: primeiro match vence (detecção automática).
 *
 * Paraná (CONSAMU / pregão oeste PR): seção 7 "MATERIAIS A SEREM DISPONIBILIZADOS".
 * Roraima (EBSERH / HU-UFRR e similares): variações comuns com vírgula ("MATERIAIS, EQUIPAMENTOS")
 * ou "RELACAO DE MATERIAIS" em anexo — ajustar regex após validar PDF real.
 */
export type EditalMateriaisProfile = {
  id: 'parana' | 'roraima';
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

export const EDITAL_MATERIAIS_PROFILE_ORDER: EditalMateriaisProfile[] = [PARANA, RORAIMA];
