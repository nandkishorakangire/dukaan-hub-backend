-- DropIndex
DROP INDEX "ads_placement_is_active_sort_order_idx";

-- AlterTable
ALTER TABLE "ads" DROP COLUMN "placement";

-- DropEnum
DROP TYPE "AdPlacement";

-- CreateIndex
CREATE INDEX "ads_is_active_sort_order_idx" ON "ads"("is_active", "sort_order");
