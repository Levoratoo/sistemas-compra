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
});
