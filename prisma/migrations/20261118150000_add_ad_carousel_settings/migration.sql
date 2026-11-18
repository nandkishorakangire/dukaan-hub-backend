-- DropIndex
DROP INDEX "ads_placement_is_active_idx";

-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "auto_play" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "duration_ms" INTEGER,
ADD COLUMN     "muted" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pausable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_sound_control" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ads_placement_is_active_sort_order_idx" ON "ads"("placement", "is_active", "sort_order");
