import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractSupplierCndMetadataFromText, inferSupplierCndScopeFromText } from './supplier-cnd-parser.js';
import { deriveSupplierCndStatus } from './supplier-cnd-status.js';

const SAMPLE_CND_TEXT = `
MINISTERIO DA FAZENDA
Secretaria da Receita Federal do Brasil
Procuradoria-Geral da Fazenda Nacional
CERTIDAO POSITIVA COM EFEITOS DE NEGATIVA DE DEBITOS RELATIVOS AOS TRIBUTOS
FEDERAIS E A DIVIDA ATIVA DA UNIAO
Nome: V CONCEICAO SILVA & CIA LTDA
CNPJ: 08.459.768/0001-30
Certidao emitida gratuitamente com base na Portaria Conjunta RFB/PGFN no 1.751, de 2/10/2014.
Emitida as 08:12:29 do dia 06/10/2025 <hora e data de Brasilia>.
Valida ate 04/04/2026.
Codigo de controle da certidao: 57A3.7F4C.ADBC.CBB2
`;

const SAMPLE_SP_RELATIVE_VALIDITY = `
CNPJ: 42.840.861/0001-28
Ressalvado o direito da Secretaria da Fazenda e Planejamento do Estado de São Paulo
Débitos Tributários Não Inscritos na Dívida Ativa do Estado de São Paulo
Data e hora da emissão
Certidão nº
Validade
www.pfe.fazenda.sp.gov.br
25120580529-88
08/12/2025 10:27:08
6 (seis) meses, contados da data de sua expedição.
`;

const SAMPLE_SP_RELATIVE_VALIDITY_TERVAC = `
CNPJ: 42.840.861/0001-28
Ressalvado o direito da Secretaria da Fazenda e Planejamento do Estado de São
Paulo de apurar débitos de responsabilidade da pessoa jurídica acima
identificada, é certificado que não constam débitos declarados ou apurados
pendentes de inscrição na Dívida Ativa de responsabilidade do estabelecimento
matriz/filial acima identificado.
Débitos Tributários Não Inscritos na Dívida Ativa do Estado de São Paulo
Data e hora da emissão
Certidão nº
Validade
Qualquer rasura ou emenda invalidará este documento.
A aceitação desta certidão está condicionada à verificação de sua autenticidade no sítio
www.pfe.fazenda.sp.gov.br
25120580529-88
08/12/2025 10:27:08
6 (seis) meses, contados da data de sua expedição.
Folha 1 de 1
Secretaria da Fazenda e Planejamento do Estado
de São Paulo
`;

const SAMPLE_STATE_ABSOLUTE_VALIDITY = `
CNPJ: 42.840.861/0001-28
Secretaria da Fazenda do Estado do Parana
Certidao Negativa de Debitos Tributarios e de Divida Ativa Estadual
Data e hora da emissao
Certidao no
Validade
25120580529-88
08/12/2025 10:27:08
08/06/2026
`;

describe('supplier cnd parser', () => {
  it('CND estadual SPF: deduz validade absoluta quando o PDF só traz vigência relativa à emissão', () => {
    const parsed = extractSupplierCndMetadataFromText(SAMPLE_SP_RELATIVE_VALIDITY);

    assert.equal(parsed.holderDocumentNumber, '42.840.861/0001-28');
    assert.equal(parsed.controlCode, '25120580529-88');
    assert.equal(parsed.issuedAt?.toISOString(), '2025-12-08T13:27:08.000Z');
    /** 6 meses após emissão: 08/06/2026 ao meio-dia BRT. */
    assert.equal(parsed.validUntil?.toISOString(), '2026-06-08T15:00:00.000Z');
  });

  it('CND estadual TERVAC: usa a data de emissao do documento e soma 6 meses', () => {
    const parsed = extractSupplierCndMetadataFromText(SAMPLE_SP_RELATIVE_VALIDITY_TERVAC);

    assert.equal(parsed.holderDocumentNumber, '42.840.861/0001-28');
    assert.equal(parsed.controlCode, '25120580529-88');
    assert.equal(parsed.issuedAt?.toISOString(), '2025-12-08T13:27:08.000Z');
    assert.equal(parsed.validUntil?.toISOString(), '2026-06-08T15:00:00.000Z');
  });

  it('extrai titular, emissao, validade e codigo de controle do layout federal', () => {
    const parsed = extractSupplierCndMetadataFromText(SAMPLE_CND_TEXT);

    assert.equal(parsed.holderName, 'V CONCEICAO SILVA & CIA LTDA');
    assert.equal(parsed.holderDocumentNumber, '08.459.768/0001-30');
    assert.equal(parsed.controlCode, '57A3.7F4C.ADBC.CBB2');
    assert.equal(parsed.issuedAt?.toISOString(), '2025-10-06T11:12:29.000Z');
    assert.equal(parsed.validUntil?.toISOString(), '2026-04-04T15:00:00.000Z');
  });

  it('CND estadual: extrai validade absoluta em layout tabular', () => {
    const parsed = extractSupplierCndMetadataFromText(SAMPLE_STATE_ABSOLUTE_VALIDITY);

    assert.equal(parsed.holderDocumentNumber, '42.840.861/0001-28');
    assert.equal(parsed.controlCode, '25120580529-88');
    assert.equal(parsed.issuedAt?.toISOString(), '2025-12-08T13:27:08.000Z');
    assert.equal(parsed.validUntil?.toISOString(), '2026-06-08T15:00:00.000Z');
  });

  it('infere o escopo correto entre federal e estadual', () => {
    assert.equal(inferSupplierCndScopeFromText(SAMPLE_CND_TEXT, 'cnd-federal.pdf'), 'FEDERAL');
    assert.equal(inferSupplierCndScopeFromText(SAMPLE_STATE_ABSOLUTE_VALIDITY, 'cnd-estadual-pr.pdf'), 'STATE');
  });

  it('marca a CND como expirada, proxima do vencimento ou valida', () => {
    assert.deepEqual(deriveSupplierCndStatus(new Date('2026-04-04T15:00:00.000Z'), new Date('2026-04-05T15:00:00.000Z')), {
      status: 'EXPIRED',
      daysUntilExpiration: -1,
    });

    assert.deepEqual(deriveSupplierCndStatus(new Date('2026-04-04T15:00:00.000Z'), new Date('2026-04-04T15:00:00.000Z')), {
      status: 'EXPIRING_SOON',
      daysUntilExpiration: 0,
    });

    assert.deepEqual(deriveSupplierCndStatus(new Date('2026-06-30T15:00:00.000Z'), new Date('2026-04-02T15:00:00.000Z')), {
      status: 'VALID',
      daysUntilExpiration: 89,
    });
  });
});
