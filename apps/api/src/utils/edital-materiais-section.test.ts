import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseEditalMateriaisDisponibilizados } from './edital-materiais-section.js';

/** Trecho mínimo no padrão CONSAMU / Paraná (seção 7). */
const FIXTURE_PARANA = `
EDITAL DE PREGÃO
7. MATERIAIS A SEREM DISPONIBILIZADOS
7.1 O contratado deverá fornecer os itens abaixo.
ITEM DESCRIÇÃO QUANTIDADE
1 Alicate de bico 2
2 Martelo de borracha 1

8. DISPOSIÇÕES GERAIS
`;

/** Trecho sintético perfil Roraima: título com vírgula (comum EBSERH), distinto do Paraná. */
const FIXTURE_RORAIMA = `
TERMO DE REFERÊNCIA — HU-UFRR
7. MATERIAIS, EQUIPAMENTOS
O fornecimento observará a tabela.
ITEM DESCRIÇÃO QTD
1 Luva procedimento 200
2 Máscara tripla 50

8. DISPOSIÇÕES FINAIS
`;

/** TR Roraima: tabela TIPO/QTD (uniformes por função), sem coluna ITEM numérica. */
const FIXTURE_RORAIMA_TR_TIPO_QTD = `
8 UNIFORMES
SOLUÇÃO ÚNICA
Agente de Portaria:
TIPO/QTD ESPECIFICAÇÃO
FEMININO / MASCULINO
Casaco
02 unidades
Tipo pulôver, fechado, com gola V, cor azul marinho, emblema bordado.
Calça
02 unidades
Calça comprida, modelo social, cor azul marinho, presilhas para cinto.
Bombeiro Civil:
TIPO/QTD ESPECIFICAÇÃO
Camiseta de algodão com identificação
02 unidades
Conforme especificação disposta na Norma Brasileira ABNT - NBR 14276.
Boné
01 unidade
Conforme especificação disposta na Norma Brasileira ABNT - NBR 14276.
9 MODELO DE GESTÃO DO CONTRATO
`;

/** Só seção 8 (uniformes), sem seção 7 reconhecida. */
const FIXTURE_SEC8_ONLY = `
CONTRATO
8 UNIFORMES
8.1.1 Camisa branca gola polo para uso administrativo
8.2.1 Calça social
`;

/** Âncora alternativa Roraima: relação de materiais (ex.: anexo). */
const FIXTURE_RORAIMA_RELACAO = `
ANEXO III
RELACAO DE MATERIAIS
ITEM DESCRIÇÃO QTD
1 Fita crepe 10

8. DISPOSIÇÕES
`;

describe('parseEditalMateriaisDisponibilizados', () => {
  it('usa perfil Paraná e extrai linhas da tabela', () => {
    const r = parseEditalMateriaisDisponibilizados(FIXTURE_PARANA);
    assert.equal(r.matchedProfile, 'parana');
    assert.equal(r.anchorFound, true);
    assert.ok(r.budgetLines.length >= 2);
    const sources = r.budgetLines.map((b) => JSON.parse(b.proposedValue).source);
    assert.ok(sources.every((s) => s === 'edital_secao_7'));
  });

  it('usa perfil roraima_tr_tabelas quando há TIPO/QTD + linhas de quantidade', () => {
    const r = parseEditalMateriaisDisponibilizados(FIXTURE_RORAIMA_TR_TIPO_QTD);
    assert.equal(r.matchedProfile, 'roraima_tr_tabelas');
    assert.equal(r.anchorFound, true);
    assert.ok(r.budgetLines.length >= 4, `esperado ≥4 linhas, obtido ${r.budgetLines.length}`);
    const first = JSON.parse(r.budgetLines[0]!.proposedValue) as { source: string; item: string };
    assert.equal(first.source, 'edital_tr_tipo_qtd_roraima');
    assert.match(first.item, /Casaco/i);
  });

  it('usa perfil Roraima quando o título traz MATERIAIS, EQUIPAMENTOS', () => {
    const r = parseEditalMateriaisDisponibilizados(FIXTURE_RORAIMA);
    assert.equal(r.matchedProfile, 'roraima');
    assert.equal(r.anchorFound, true);
    assert.ok(r.budgetLines.length >= 2);
    const sources = r.budgetLines.map((b) => JSON.parse(b.proposedValue).source);
    assert.ok(sources.every((s) => s === 'edital_secao_7_roraima'));
  });

  it('usa subâncora Roraima RELACAO DE MATERIAIS', () => {
    const r = parseEditalMateriaisDisponibilizados(FIXTURE_RORAIMA_RELACAO);
    assert.equal(r.matchedProfile, 'roraima');
    assert.equal(r.subsectionFound, true);
    assert.ok(r.budgetLines.length >= 1);
  });

  it('sem seção 7: fallback seção 8 uniformes', () => {
    const r = parseEditalMateriaisDisponibilizados(FIXTURE_SEC8_ONLY);
    assert.equal(r.matchedProfile, 'sec8_uniformes');
    assert.equal(r.anchorFound, true);
    assert.ok(r.budgetLines.length >= 1);
  });
});
