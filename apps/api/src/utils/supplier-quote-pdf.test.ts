import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractHeaderInfo, parseSupplierQuoteRows } from './supplier-quote-pdf.js';

describe('supplier quote pdf parser', () => {
  it('parseia linha com quantidade depois da unidade e valor total depois do desconto', () => {
    const rows = parseSupplierQuoteRows('001777 TOUCA DESCARTAVEL VOLK C/ 100 PC 15 13,9000 208,50 0,0000% 13,9000');
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.description, 'TOUCA DESCARTAVEL VOLK C/');
    assert.equal(rows[0]?.quantity, 15);
    assert.equal(rows[0]?.unit, 'PC');
    assert.equal(rows[0]?.unitPrice, 13.9);
    assert.equal(rows[0]?.totalValue, 208.5);
  });

  it('parseia linha OCR do W&M com codigo, unidade e quantidade corretos', () => {
    const rows = parseSupplierQuoteRows('1538/1 LUVA NITRILICA SEM PO M AZUL C/100 MEDIX CX 10 ox 24,85 248,50');
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.description, 'LUVA NITRILICA SEM PO M AZUL C/100 MEDIX');
    assert.equal(rows[0]?.quantity, 10);
    assert.equal(rows[0]?.unit, 'CX');
    assert.equal(rows[0]?.unitPrice, 24.85);
    assert.equal(rows[0]?.totalValue, 248.5);
  });

  it('parseia layout com unidade antes da quantidade como no Colegial', () => {
    const rows = parseSupplierQuoteRows('142 ARQUIVO PRONTOBOX 4008 AZUL UNIDADE UN 20 8,75 175,00');
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.description, 'ARQUIVO PRONTOBOX 4008 AZUL UNIDADE');
    assert.equal(rows[0]?.quantity, 20);
    assert.equal(rows[0]?.unit, 'UN');
    assert.equal(rows[0]?.unitPrice, 8.75);
    assert.equal(rows[0]?.totalValue, 175);
  });

  it('parseia layout com coluna de cancelamento no fim como na Central Ferragens', () => {
    const rows = parseSupplierQuoteRows('7898578169624 SERRA COPO DIAMANTADA COM HASTE 20MM PC 1,00 69,00 0,00 69,00 69,00 N');
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.description, 'SERRA COPO DIAMANTADA COM HASTE 20MM');
    assert.equal(rows[0]?.quantity, 1);
    assert.equal(rows[0]?.unit, 'PC');
    assert.equal(rows[0]?.unitPrice, 69);
    assert.equal(rows[0]?.totalValue, 69);
  });

  it('extrai numero do orcamento e pedido do cabecalho', () => {
    const wemHeader = extractHeaderInfo('Num. Orçamento: 003048 Data: 09/02/26\nW&M COMERCIO DE PRODUTOS MEDICOS HOSPITALARES LTDA');
    assert.equal(wemHeader.quoteNumber, '003048');

    const jailonHeader = extractHeaderInfo('PEDIDO Nº: 94016\nV. FRANCISCO DA SILVA LTDA');
    assert.equal(jailonHeader.quoteNumber, '94016');
  });
  it('parseia layout com descricao em varias linhas e linha de preco separada como no Instituto IDEAS', () => {
    const rows = parseSupplierQuoteRows(`
1 CALÇA ATLAS -
CREME (38)
R$310,00 6 R$ 1,860,00
2 CALÇA ATLAS -
CREME (44)
R$310,00 2 R$ 620,00
20 PRANCHA DE
RESGATE COM
TIRANTE
R$1,000,0
0 01 R$ 1,000,00
29 LUVA PROTETORA
C.A 8820
R$70,00 8 R$ 560,00
    `);

    assert.equal(rows.length, 4);
    assert.deepEqual(rows[0], {
      rowIndex: 0,
      rawText: '1 CALÇA ATLAS - CREME (38) R$310,00 6 R$ 1,860,00',
      description: 'CALÇA ATLAS CREME (38)',
      quantity: 6,
      unit: null,
      unitPrice: 310,
      totalValue: 1860,
    });
    assert.equal(rows[2]?.description, 'PRANCHA DE RESGATE COM TIRANTE');
    assert.equal(rows[2]?.quantity, 1);
    assert.equal(rows[2]?.unitPrice, 1000);
    assert.equal(rows[2]?.totalValue, 1000);
    assert.equal(rows[3]?.description, 'LUVA PROTETORA C.A 8820');
  });

  it('parseia layout sem numeracao de item com descricao em bloco e preco abaixo', () => {
    const rows = parseSupplierQuoteRows(`
CALÇA ATLAS -
CREME (38)
R$300,00 6 R$ 1,800,00
CAMISETA
VERMELHA
BOMBEIRO CIVIL,
PP OU PV- (P)
R$82,00 2 R$ 164,00
PRANCHA DE
RESGATE COM
TIRANTE
R$1,050,00 01 R$ 1,050,00
    `);

    assert.equal(rows.length, 3);
    assert.equal(rows[0]?.description, 'CALÇA ATLAS CREME (38)');
    assert.equal(rows[0]?.quantity, 6);
    assert.equal(rows[0]?.unitPrice, 300);
    assert.equal(rows[0]?.totalValue, 1800);
    assert.equal(rows[1]?.description, 'CAMISETA VERMELHA BOMBEIRO CIVIL, PP OU PV (P)');
    assert.equal(rows[2]?.description, 'PRANCHA DE RESGATE COM TIRANTE');
    assert.equal(rows[2]?.quantity, 1);
    assert.equal(rows[2]?.unitPrice, 1050);
    assert.equal(rows[2]?.totalValue, 1050);
  });
  it('ignora marcador de pagina e preserva codigo CA em layout sem numeracao', () => {
    const rows = parseSupplierQuoteRows(`
GANDOLETA
VERMELHA XG
1 of 2
R$240,00 1 R$ 240,00
MASCARA DE PROTECAO C.A
30592
R$24,00 30 R$ 720,00
    `);

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.description, 'MASCARA DE PROTECAO C.A 30592');
    assert.equal(rows[0]?.quantity, 30);
    assert.equal(rows[0]?.unitPrice, 24);
    assert.equal(rows[0]?.totalValue, 720);
  });
});
