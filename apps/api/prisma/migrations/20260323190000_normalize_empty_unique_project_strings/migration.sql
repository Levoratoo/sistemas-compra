-- Corrige dados antigos: '' em colunas de UNIQUE composta (órgão + processo/contrato) colide no SQLite.
UPDATE "Project" SET "procurementProcessNumber" = NULL
WHERE "procurementProcessNumber" IS NOT NULL AND TRIM("procurementProcessNumber") = '';

UPDATE "Project" SET "contractNumber" = NULL
WHERE "contractNumber" IS NOT NULL AND TRIM("contractNumber") = '';
