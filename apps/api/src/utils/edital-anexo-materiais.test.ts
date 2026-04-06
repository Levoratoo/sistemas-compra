import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  extractBudgetLinesFromGenericRoleTables,
  extractBudgetLinesFromPostoEpiTables,
  extractBudgetLinesFromUniformKitTables,
} from './edital-anexo-materiais.js';
import { parseEditalMateriaisDisponibilizados } from './edital-materiais-section.js';

const FIXTURE_GENERIC_TIPO_QTD = `
Arquivista:
FEMININO / MASCULINO
TIPO/QTD ESPECIFICAÇÃO
Paletó
02 unidades
Tipo pulôver, aberto, com gola V.
Calça
02 unidades  Calça comprida modelo social.
Meias
03 pares
Modelo feminino: meias finas 3/4.
Modelo masculino: tipo social, cor preta.
Obs.: para o início do contrato deverão ser fornecidos 4 pares.
Auxiliar de arquivo:
FEMININO / MASCULINO
TIPO/QTD ESPECIFICAÇÃO
Casaco
01 unidade
Tipo pulôver, fechado, com gola V.
`;

const FIXTURE_ITEM_QTDE = `
Bombeiro civil:
FEMININO / MASCULINO
ITEM QTDE.
Óculos de proteção contra chamas 1
Protetor auditivo de inserção reutilizável (par) 2
Máscara PFF2/N95 4
OBSERVAÇÕES GERAIS:
`;

const FIXTURE_POSTO_EPI = `
12.6.5. Segue a relação de EPI que a Contratada deverá disponibilizar aos seus funcionários em quantidades anuais:
POSTO DE TRABALHO EPI
Recepcionista
Máscaras Respirador PFF2 por ano (ou uma máscara por mês)
Luvas de procedimento por ano
Vigilante
Coturno
Óculos de proteção
Luvas de procedimento com 50 pares cada por ano
12.6.5.1. Os quantitativos estão definidos nas planilhas.
`;

const FIXTURE_UNIFORM_KIT = `
16.2.3.1. O uniforme exclusivo para o serviço de Recepção deverá compreender as peças do vestuário:
Tipo Especificação
Camisa Camisa de manga curta, estilo social ou polo com a logomarca da empresa.
Calça Calça com estilo social em tecido brim ou oxford.
Casaco Casaco de frio estilo social.
Sapato Sapato fechado na cor preta.
16.2.4. Deverão ser entregues 02 (dois) conjuntos completos ao empregado no início da execução do contrato,
devendo ser substituído 01 (um) conjunto completo de uniforme anualmente.
`;

const FIXTURE_UNIFORM_DUP_NOISE = `
16.2.3.1. O uniforme exclusivo para o serviço de Recepção deverá compreender as peças do vestuário:
Tipo Especificação
Camisa Camisa de manga curta, estilo social ou polo com a logomarca da empresa.
Calça Calça com estilo social em tecido brim ou oxford.
Casaco Casaco de frio estilo social.
Sapato Sapato fechado na cor preta.
Sapato Sapato fechado na cor preta EPI's (incidência de insalubridade):
16.2.3.2. Deverão ser fornecidos às recepcionistas os devidos EPI's.
16.2.4. Deverão ser entregues 02 (dois) conjuntos completos ao empregado no início da execução do contrato,
devendo ser substituído 01 (um) conjunto completo de uniforme anualmente.
`;

describe('edital-anexo-materiais', () => {
  it('extrai tabela generica TIPO/QTD sem engolir o proximo cargo', () => {
    const rows = extractBudgetLinesFromGenericRoleTables(FIXTURE_GENERIC_TIPO_QTD);
    assert.ok(rows.length >= 4);

    const meias = rows.find((row) => row.proposedValue.includes('"item":"Meias"'));
    assert.ok(meias);
    assert.match(meias!.recordGroupKey ?? '', /Arquivista/);
    assert.doesNotMatch(meias!.proposedValue, /Auxiliar de arquivo/);
  });

  it('extrai tabela ITEM QTDE para epi com quantidade numerica', () => {
    const rows = extractBudgetLinesFromGenericRoleTables(FIXTURE_ITEM_QTDE);
    assert.ok(rows.length >= 3);
    assert.match(rows[0]!.proposedValue, /edital_epi_item_qtde/);
    assert.match(rows[0]!.proposedValue, /"quantity":"1"/);
  });

  it('extrai bloco POSTO DE TRABALHO EPI com quantidade textual quando necessario', () => {
    const rows = extractBudgetLinesFromPostoEpiTables(FIXTURE_POSTO_EPI);
    assert.ok(rows.length >= 4);

    const luvas = rows.find((row) => row.proposedValue.includes('50 pares cada por ano'));
    assert.ok(luvas);
    assert.match(luvas!.recordGroupKey ?? '', /Vigilante/);
    assert.match(luvas!.proposedValue, /edital_epi_posto_lista/);
  });

  it('extrai quadro simples de uniforme com regra de kit', () => {
    const rows = extractBudgetLinesFromUniformKitTables(FIXTURE_UNIFORM_KIT);
    assert.ok(rows.length >= 4);
    assert.match(rows[0]!.proposedValue, /02 conjuntos iniciais/i);
    assert.match(rows[0]!.proposedValue, /edital_uniforme_kit_table/);
  });

  it('deduplica item repetido quando o pdf cola o inicio do bloco seguinte na descricao', () => {
    const rows = extractBudgetLinesFromUniformKitTables(FIXTURE_UNIFORM_DUP_NOISE);
    assert.equal(rows.length, 4);
    const sapatoRows = rows.filter((row) => row.proposedValue.includes('"item":"Sapato"'));
    assert.equal(sapatoRows.length, 1);
    assert.doesNotMatch(sapatoRows[0]!.proposedValue, /insalubridade/i);
  });

  it('parser principal incorpora tabelas de anexos quando nao existe secao 7 classica', () => {
    const parsed = parseEditalMateriaisDisponibilizados(
      `${FIXTURE_UNIFORM_KIT}\n\n${FIXTURE_POSTO_EPI}\n\n${FIXTURE_ITEM_QTDE}`,
    );
    assert.equal(parsed.anchorFound, true);
    assert.ok(parsed.budgetLines.length >= 8);
    assert.notEqual(parsed.matchedProfile, null);
  });
});
