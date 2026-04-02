ALTER TABLE "Supplier"
ADD COLUMN "cndIssuedAt" TIMESTAMP(3),
ADD COLUMN "cndValidUntil" TIMESTAMP(3),
ADD COLUMN "cndControlCode" TEXT,
ADD COLUMN "cndSourceFileName" TEXT;
