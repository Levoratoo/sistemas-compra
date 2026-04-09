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

  it('parseia linha inline com prefixo Produto e mantem quantidade e preco corretos', () => {
    const rows = parseSupplierQuoteRows('Produto: CALÇA ATLAS - CREME (38) 290,00 6 1.740,00');
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.description, 'CALÇA ATLAS CREME (38)');
    assert.equal(rows[0]?.quantity, 6);
    assert.equal(rows[0]?.unitPrice, 290);
    assert.equal(rows[0]?.totalValue, 1740);
  });

  it('parseia OCR com decimal misto em valor total e recupera item de produto inline', () => {
    const rows = parseSupplierQuoteRows(`
Produto: LANTERNA TATICA PARA USO DE BOMBEIROS 70,00 08 560.00
Produto: UND BATERIAS PARA LANTERNAS 30,00 08 240,00
Produtos: PROTETOR AURICULAR CA 5745 130.00 08 1,040.00
    `);

    assert.equal(rows.length, 3);
    assert.equal(rows[0]?.description, 'LANTERNA TATICA PARA USO DE BOMBEIROS');
    assert.equal(rows[0]?.quantity, 8);
    assert.equal(rows[0]?.unitPrice, 70);
    assert.equal(rows[0]?.totalValue, 560);
    assert.equal(rows[1]?.description, 'UND BATERIAS PARA LANTERNAS');
    assert.equal(rows[1]?.quantity, 8);
    assert.equal(rows[1]?.unitPrice, 30);
    assert.equal(rows[1]?.totalValue, 240);
    assert.equal(rows[2]?.description, 'PROTETOR AURICULAR CA 5745');
    assert.equal(rows[2]?.quantity, 8);
    assert.equal(rows[2]?.unitPrice, 130);
    assert.equal(rows[2]?.totalValue, 1040);
  });

  it('extrai numero do orcamento e pedido do cabecalho', () => {
    const wemHeader = extractHeaderInfo('Num. Orçamento: 003048 Data: 09/02/26\nW&M COMERCIO DE PRODUTOS MEDICOS HOSPITALARES LTDA');
    assert.equal(wemHeader.quoteNumber, '003048');

    const jailonHeader = extractHeaderInfo('PEDIDO Nº: 94016\nV. FRANCISCO DA SILVA LTDA');
    assert.equal(jailonHeader.quoteNumber, '94016');
  });

  it('extrai alias do fornecedor a partir de e-mail OCR quando o nome vier ruidoso', () => {
    const header = extractHeaderInfo(`
<b FIRE JGPREVENFIRE CNPJ- o
jgprevenfireQgmail.com
DADOS DA VENDA
CLIENTE: Instituto de Desenvolvimento
    `);

    assert.equal(header.supplierNameDetected, 'JGPREVENFIRE');
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

  it('parseia linha só com quantidade e dois R$ un/total (Carrinho Ideas) juntando descrição acima', () => {
    const rows = parseSupplierQuoteRows(`
Carrinho abastecedor
Especificações Técnicas:
:: Altura total: 1000mm
03 R$ 1.670,00 R$ 5.010,00
`);

    assert.equal(rows.length, 1);
    assert.match(rows[0]?.description ?? '', /Carrinho abastecedor/i);
    assert.equal(rows[0]?.quantity, 3);
    assert.equal(rows[0]?.unitPrice, 1670);
    assert.equal(rows[0]?.totalValue, 5010);
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

  it('parseia layout com quantidade no inicio como no RC Papeis', () => {
    const rows = parseSupplierQuoteRows(
      '2,000 UN PAPEL A4 BRANCO C/500 DG FOX 75G 59,00 29,50 59,00 7244',
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.description, 'PAPEL A4 BRANCO C/500 DG FOX 75G');
    assert.equal(rows[0]?.quantity, 2);
    assert.equal(rows[0]?.unit, 'UN');
    assert.equal(rows[0]?.unitPrice, 29.5);
    assert.equal(rows[0]?.totalValue, 59);
  });

  it('parseia layout com codigo na frente e quantidade apos unidade como no OCR do RC Papeis', () => {
    const rows = parseSupplierQuoteRows(
      '7244 PAPEL A4 BRANCO C/500 DG FOX 75G UN 2,000 29,50 59,00 59,00',
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.description, 'PAPEL A4 BRANCO C/500 DG FOX 75G');
    assert.equal(rows[0]?.quantity, 2);
    assert.equal(rows[0]?.unit, 'UN');
    assert.equal(rows[0]?.unitPrice, 29.5);
    assert.equal(rows[0]?.totalValue, 59);
  });

  it('parseia bloco OCR com qtd valor e total como no CamScanner', () => {
    const rows = parseSupplierQuoteRows(`
9745 Qtd: 2,00
ALCOOL LIQUIDO 70% 1 LT SEVENGEL Valor: 10,00
Total: 20,00
668 Qtd: 16,00
CAFE CABOCLO 500G TRADICIONAL Valor: 33,90
Total: 542,40
    `);

    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.description, 'ALCOOL LIQUIDO 70% 1 LT SEVENGEL');
    assert.equal(rows[0]?.quantity, 2);
    assert.equal(rows[0]?.unitPrice, 10);
    assert.equal(rows[0]?.totalValue, 20);
    assert.equal(rows[1]?.description, 'CAFE CABOCLO 500G TRADICIONAL');
    assert.equal(rows[1]?.quantity, 16);
    assert.equal(rows[1]?.unitPrice, 33.9);
    assert.equal(rows[1]?.totalValue, 542.4);
  });

  it('parseia proposta com quantidade na frente como no HG MAX', () => {
    const rows = parseSupplierQuoteRows(
      '10 CÓD: 348 - QUADRO DE ANDAIME TUBULAR 100X100 - NAC 193,50 R$ 1.935,00 R$',
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.description, 'QUADRO DE ANDAIME TUBULAR 100X100 NAC');
    assert.equal(rows[0]?.quantity, 10);
    assert.equal(rows[0]?.unitPrice, 193.5);
    assert.equal(rows[0]?.totalValue, 1935);
  });

  it('parseia proposta com descricao antes da quantidade como na ZOX', () => {
    const rows = parseSupplierQuoteRows(
      'Painel de andaime 1,0m X 1,0m. 10 162,00 R$ 1.620,00 R$',
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.description, 'Painel de andaime 1,0m X 1,0m');
    assert.equal(rows[0]?.quantity, 10);
    assert.equal(rows[0]?.unitPrice, 162);
    assert.equal(rows[0]?.totalValue, 1620);
  });

  it('parseia linha OCR rotacionada como na LBN', () => {
    const rows = parseSupplierQuoteRows(
      '1 G6190-002 10,00 UN ANDAIME TUBULAR PAINEL DE 1000 - LARANJA 195,00 1.950,00',
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.description, 'ANDAIME TUBULAR PAINEL DE 1000 LARANJA');
    assert.equal(rows[0]?.quantity, 10);
    assert.equal(rows[0]?.unit, 'UN');
    assert.equal(rows[0]?.unitPrice, 195);
    assert.equal(rows[0]?.totalValue, 1950);
  });

  it('prefere o nome do fornecedor e nao uma linha de item no cabecalho', () => {
    const header = extractHeaderInfo(`
RC PAPEIS
Cliente: DESAFIO JOVEM MONTE DAS OLIVEIRAS
31918 Papel Chamex 210X297 75G Branco A4 Pc C/500 Fls CMX075CA4 PC 20 23,99 479,80
08/04/2026
    `);

    assert.equal(header.supplierNameDetected, 'RC PAPEIS');
  });

  it('ignora frases genericas de condicao comercial quando nao ha fornecedor no cabecalho', () => {
    const header = extractHeaderInfo(`
Orçamento :
Cliente:
Prazo de Entrega :
Cnd. Pagamento :
Validade :
Cobrança :
02.309.984/0001-12 - DESAFIO JOVEM MONTE DAS OLIVEIRAS
CASSIO
A INFORMAR (47) 33320871
22/04/2026
A DEFINIR
A COMBINAR
    `);

    assert.equal(header.supplierNameDetected, null);
  });
});
