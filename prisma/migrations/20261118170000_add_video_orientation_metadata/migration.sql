-- Per-video orientation metadata for carousels. Empty/unset values are
-- auto-detected from the video headers by the API when a row is written.
-- The video URL columns were added to the Prisma schema without a migration;
-- keep them here so a fresh database can still run the carousel code.
ALTER TABLE "ads" ADD COLUMN IF NOT EXISTS "video_url" TEXT;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "videos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "ads" ADD COLUMN "video_orientation" TEXT;

ALTER TABLE "businesses" ADD COLUMN "video_orientations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
