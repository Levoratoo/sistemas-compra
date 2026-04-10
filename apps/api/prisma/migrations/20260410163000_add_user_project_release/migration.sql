CREATE TABLE "UserProjectRelease" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProjectRelease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserProjectRelease_userId_projectId_key" ON "UserProjectRelease"("userId", "projectId");
CREATE INDEX "UserProjectRelease_userId_idx" ON "UserProjectRelease"("userId");
CREATE INDEX "UserProjectRelease_projectId_idx" ON "UserProjectRelease"("projectId");

ALTER TABLE "UserProjectRelease"
ADD CONSTRAINT "UserProjectRelease_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserProjectRelease"
ADD CONSTRAINT "UserProjectRelease_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
