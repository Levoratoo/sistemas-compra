import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  extractBudgetLinesFromCuiabaEpiAnnex,
  extractBudgetLinesFromCuiabaEquipmentAnnex,
  extractBudgetLinesFromCuiabaUniformAnnex,
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

const FIXTURE_CUIABA_UNIFORM_ANNEX = `
ANEXO I - B
DETALHAMENTO DOS UNIFORMES
2.2. Os kits serão compostos segundo a listagem dos uniformes necessários abaixo, separados por cargo:
RECEPCIONISTA, AUXILIAR DE DOCUMENTAÇÃO, PORTEIRO, DIGITADOR, CONTÍNUO.
TIPO DE UNIFORME MASCULINO QUANTIDADE
SEMESTRAL
Calça jeans escura. 01 unidade
Camisa gola polo, cor cinza claro, em Piquet, manga curta, com detalhe
em verde (ebserh), contendo bordado com o nome da empresa contratada
01 unidade
Calçado fechado macio, modelo básico, linha profissional, solado
antiderrapante, confortável. 01 par
Meia branca material macio e confortável 02 pares
TIPO DE UNIFORME FEMININO QUANTIDADE
SEMESTRAL
Camisa gola polo feminina, cinza claro, em Piquet, manga curta com detalhe
em verde (ebserh), contendo bordado com o nome da empresa contratada
01 unidade
Calça jeans escura. 01 unidade
Calçado fechado macio, modelo básico, linha profissional, solado
antiderrapante, confortável 01 par
Meia branca material macio e confortável 02 pares
MAQUEIRO
TIPO DE UNIFORME MASCULINO / FEMININO QUANTIDADE
SEMESTRAL
Scrub - Pijama cirúrgico, sendo:
Camisa gola V, manga curta, 1 bolso na parte superior esquerda, tecido 100% algodão
Calça Scrub cintura com elástico, cordão de ajuste, um bolso superior
02 unidades
Meia em algodão, cor branca 02 pares
ENCARREGADO
TIPO DE UNIFORME MASCULINO / FEMININO QUANTIDADE
SEMESTRAL
Camisa social manga comprida 01 unidade
Calça social com presilhas para cinto 01 unidade
Sapato social em Couro preto, linha conforto 01 par
Meia, tecido em nylon cor preta 02 pares
Orientação - SEI 1 (44298243) SEI 23532.000274/2024-71 / pg. 2
Cinto em couro, na cor preta 01 unidade
2.3. No caso de a empregada estar em fase de gestação.
`;

const FIXTURE_CUIABA_EPI_ANNEX = `
ANEXO I - C
DETALHAMENTO DO EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAIS (EPI)
CARGO LOTAÇÃO EPI'S A SEREM FORNECIDOS QUANTIDADE/EMPREGADO/ANO
Almoxarife
Unidade de
Abastecimento e Controle
de Estoques
Cinta ergonômica 01
Luva de algodão com pigmentos 12
Sapato de segurança com biqueira de PVC ou composite 02
Auxiliar de documentação
* *
* *
Contínuo
Unidade de Patrimônio
Cinta ergonômica 01
Luva de algodão com pigmentos 24
Sapato de segurança em couro com biqueira de
PVC ou composite 01
Unidade de Suporte Operacional
Luva látex de procedimento cano médio 24 cx c/ 50und.
Digitador Centrais de Digitação * *
Encarregado - * *
Maqueiro
Setor de Hotelaria Hospitalar (Transporte assistencial)
Unidade Bloco Cirúrgico, RPA e CME
Cinta ergonômica 01
Luva látex de procedimento cano médio 24 cx c/ 50und.
Porteiro Portarias * *
Recepcionista Diversos * *
Secretário Executivo Superintendência * *
1.5. Também deverão ser fornecidos.
`;

const FIXTURE_CUIABA_EQUIPMENT_ANNEX = `
ANEXO I - I
EQUIPAMENTOS A SEREM FORNECIDOS PELA CONTRATADA
EQUIPAMENTO ESPECIFICAÇÃO QUANTIDADE ILUSTRAÇÃO*
APARELHOS
RÁDIOS (HT)
TRANSMISSORES
PARA
COMUNICAÇÃO
Aparelhos rádios transmissores para comunicação do tipo digital.
8
CARRINHO DUPLO
COM CAIXAS DE
ARMAZENAMENTO
70 LITROS
REMOVIVÉIS
Carrinho de transporte multinível em aço.
03
CARRINHO
AUXILIAR
TOTALMENTE EM
AÇO INOX COM
CESTO polido. Rodízios de 180mm.
01
MALETA DE
TRANSPORTE DE
MATERIAL
BIOLÓGICO
CAIXA TÉRMICA PARA TRANSPORTE DE AMOSTRAS BIOLÓGICAS com tampa com trava. 02
FONE DE OUVIDO
(HEADSET)
Headset modelo confortável, de uso on ear, com cancelamento de ruído.
04
*Imagens meramente ilustrativas.
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

  it('extrai anexo de uniformes de Cuiaba sem capturar rodape como item', () => {
    const rows = extractBudgetLinesFromCuiabaUniformAnnex(FIXTURE_CUIABA_UNIFORM_ANNEX);
    assert.equal(rows.length, 15);
    assert.ok(rows.some((row) => row.proposedValue.includes('Calçado fechado macio, modelo básico, linha profissional, solado antiderrapante, confortável')));
    assert.ok(rows.some((row) => row.proposedValue.includes('"item":"Masculino / Feminino — Cinto em couro, na cor preta"')));
    assert.ok(rows.every((row) => !row.proposedValue.includes('Orientação - SEI')));
  });

  it('extrai anexo de EPI de Cuiaba preservando lotacao e quantidades', () => {
    const rows = extractBudgetLinesFromCuiabaEpiAnnex(FIXTURE_CUIABA_EPI_ANNEX);
    assert.equal(rows.length, 9);
    assert.ok(rows.some((row) => row.proposedValue.includes('"item":"Cinta ergonômica"')));
    assert.ok(rows.some((row) => row.proposedValue.includes('"quantity":"24 caixas"') || row.proposedValue.includes('"quantity":"24 cx c/ 50und."')));
    assert.ok(rows.some((row) => row.proposedValue.includes('Unidade de Abastecimento e Controle de Estoques')));
    assert.ok(rows.every((row) => !row.proposedValue.includes('sob demanda')));
  });

  it('extrai anexo de equipamentos de Cuiaba sem perder item quebrado em pagina', () => {
    const rows = extractBudgetLinesFromCuiabaEquipmentAnnex(FIXTURE_CUIABA_EQUIPMENT_ANNEX);
    assert.equal(rows.length, 5);
    assert.ok(rows.some((row) => row.proposedValue.includes('"item":"CARRINHO AUXILIAR TOTALMENTE EM AÇO INOX COM CESTO"')));
    assert.ok(rows.some((row) => row.proposedValue.includes('"item":"MALETA DE TRANSPORTE DE MATERIAL BIOLÓGICO"')));
    assert.ok(rows.every((row) => !row.proposedValue.includes('Orientação - SEI')));
  });

  it('parser principal reconhece anexos de Cuiaba como fonte valida de materiais', () => {
    const parsed = parseEditalMateriaisDisponibilizados(
      `${FIXTURE_CUIABA_UNIFORM_ANNEX}\n\n${FIXTURE_CUIABA_EPI_ANNEX}\n\n${FIXTURE_CUIABA_EQUIPMENT_ANNEX}`,
    );
    assert.equal(parsed.anchorFound, true);
    assert.equal(parsed.matchedProfile, 'cuiaba_annexes');
    assert.ok(parsed.budgetLines.length >= 29);
  });
});
