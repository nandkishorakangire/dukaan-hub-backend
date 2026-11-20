-- Rename the business entity to marketplace while preserving all existing data.

ALTER TABLE "businesses" RENAME TO "marketplaces";
ALTER TABLE "business_pages" RENAME TO "marketplace_pages";

ALTER TABLE "products" RENAME COLUMN "business_id" TO "marketplace_id";
ALTER TABLE "orders" RENAME COLUMN "business_id" TO "marketplace_id";
ALTER TABLE "ads" RENAME COLUMN "business_id" TO "marketplace_id";
ALTER TABLE "marketplace_pages" RENAME COLUMN "business_id" TO "marketplace_id";

ALTER TABLE "marketplaces" RENAME CONSTRAINT "businesses_pkey" TO "marketplaces_pkey";
ALTER TABLE "marketplace_pages" RENAME CONSTRAINT "business_pages_pkey" TO "marketplace_pages_pkey";

ALTER INDEX "businesses_slug_key" RENAME TO "marketplaces_slug_key";
ALTER INDEX "businesses_owner_id_idx" RENAME TO "marketplaces_owner_id_idx";
ALTER INDEX "businesses_category_idx" RENAME TO "marketplaces_category_idx";
ALTER INDEX "businesses_is_featured_idx" RENAME TO "marketplaces_is_featured_idx";
ALTER INDEX "businesses_trend_score_idx" RENAME TO "marketplaces_trend_score_idx";

ALTER INDEX "products_business_id_idx" RENAME TO "products_marketplace_id_idx";
ALTER INDEX "orders_business_id_idx" RENAME TO "orders_marketplace_id_idx";
ALTER INDEX "ads_business_id_idx" RENAME TO "ads_marketplace_id_idx";
ALTER INDEX "business_pages_business_id_idx" RENAME TO "marketplace_pages_marketplace_id_idx";
ALTER INDEX "business_pages_business_id_slug_key" RENAME TO "marketplace_pages_marketplace_id_slug_key";

ALTER TABLE "marketplaces" RENAME CONSTRAINT "businesses_owner_id_fkey" TO "marketplaces_owner_id_fkey";
ALTER TABLE "products" RENAME CONSTRAINT "products_business_id_fkey" TO "products_marketplace_id_fkey";
ALTER TABLE "orders" RENAME CONSTRAINT "orders_business_id_fkey" TO "orders_marketplace_id_fkey";
ALTER TABLE "marketplace_pages" RENAME CONSTRAINT "business_pages_business_id_fkey" TO "marketplace_pages_marketplace_id_fkey";
ALTER TABLE "ads" RENAME CONSTRAINT "ads_business_id_fkey" TO "ads_marketplace_id_fkey";
