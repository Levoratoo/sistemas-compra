-- CreateEnum
CREATE TYPE "FolderSurfaceStyle" AS ENUM ('SOLID', 'GRADIENT', 'RADIAL');

-- AlterTable
ALTER TABLE "ProjectDocumentFolder" ADD COLUMN "surfaceStyle" "FolderSurfaceStyle" NOT NULL DEFAULT 'GRADIENT';
