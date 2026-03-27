import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseOcrSupplyTable } from './ocr-table-postprocess.js';

/** Texto bagunçado típico de OCR em tabela 2 colunas (exemplo do usuário). */
const MESSY_OCR_SAMPLE = `
Casaco Tecido em microfibra, tweed ou two way, forrado internamente (inclusive manga), modelo social, cor azul marinho, manga longa,
gee com dois bolsos frontais (abertos), 2 botões, emblema da empresa bordado no lado superior esquerdo. Adequado as peculiaridades
climáticas da localidade de prestação dos serviços.
Calça Calça comprida, modelo social, fechamento frontal por zíper, da mesma cor e tecido do paletó, 2 bolsos laterais e 2 traseiros, com
02 unidades presilhas para cinto.
Camisa Social Camisa social em microfibra, cor azul claro, gola com entretela, manga comprida com botões nos punhos e emblema da empresa no
03 unidades lado esquerdo superior.
Sapatos
janet Cor preta, calçado em couro, tipo social, fechado, palmilha conforto, solado antiderrapante.
Cinto Cor preta, modelo social, em couro, com fivela em metal e garra regulável.
01 unidade
Meias Cor preta, tipo social.
03 pares Obs.: para o início do contrato deverão ser fornecido 4 pares para cada empregado terceirizado.
`;

describe('parseOcrSupplyTable', () => {
  it('segmenta por item e extrai quantidade quando presente no bloco', () => {
    const rows = parseOcrSupplyTable(MESSY_OCR_SAMPLE);
    if (process.env.DEBUG_OCR) {
      // eslint-disable-next-line no-console -- debug
      console.log(JSON.stringify(rows, null, 2));
    }
    assert.ok(rows.length >= 5, `esperado ≥5 linhas, obtido ${rows.length}`);

    const casaco = rows.find((r) => r.item.toLowerCase() === 'casaco');
    assert.ok(casaco);
    assert.ok(casaco!.description.includes('microfibra') || casaco!.description.includes('Tecido'));

    const calça = rows.find((r) => r.item.toLowerCase() === 'calça');
    assert.ok(calça);
    assert.match(calça!.quantity, /02\s+unidades/i);

    const camisa = rows.find((r) => r.item.toLowerCase().includes('camisa'));
    assert.ok(camisa);
    assert.match(camisa!.quantity, /03\s+unidades/i);

    const meias = rows.find((r) => r.item.toLowerCase() === 'meias');
    assert.ok(meias);
    assert.match(meias!.quantity, /03\s+pares/i);

    const cinto = rows.find((r) => r.item.toLowerCase() === 'cinto');
    assert.ok(cinto);
    assert.match(cinto!.quantity, /01\s+unidade/i);
  });
});
