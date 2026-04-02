import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractSupplierCndMetadataFromText } from './supplier-cnd-parser.js';
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

describe('supplier cnd parser', () => {
  it('extrai titular, emissao, validade e codigo de controle do layout federal', () => {
    const parsed = extractSupplierCndMetadataFromText(SAMPLE_CND_TEXT);

    assert.equal(parsed.holderName, 'V CONCEICAO SILVA & CIA LTDA');
    assert.equal(parsed.holderDocumentNumber, '08.459.768/0001-30');
    assert.equal(parsed.controlCode, '57A3.7F4C.ADBC.CBB2');
    assert.equal(parsed.issuedAt?.toISOString(), '2025-10-06T11:12:29.000Z');
    assert.equal(parsed.validUntil?.toISOString(), '2026-04-04T15:00:00.000Z');
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
