-- One media per ad. The old row carried an image_url and an optional video_url;
-- collapse them into a single media_url plus an explicit media_type. A video's
-- former image_url is kept as its optional poster for the loading state.

CREATE TYPE "AdMediaType" AS ENUM ('image', 'status_image', 'video', 'status_video');

ALTER TABLE "ads"
  ADD COLUMN "media_url" TEXT,
  ADD COLUMN "media_type" "AdMediaType",
  ADD COLUMN "poster_url" TEXT;

UPDATE "ads"
SET
  "media_url" = CASE
    WHEN NULLIF("video_url", '') IS NOT NULL THEN "video_url"
    ELSE "image_url"
  END,
  "media_type" = CASE
    WHEN NULLIF("video_url", '') IS NOT NULL AND "auto_play" = false THEN 'status_video'::"AdMediaType"
    WHEN NULLIF("video_url", '') IS NOT NULL THEN 'video'::"AdMediaType"
    WHEN "auto_play" = false THEN 'status_image'::"AdMediaType"
    ELSE 'image'::"AdMediaType"
  END,
  "poster_url" = CASE
    WHEN NULLIF("video_url", '') IS NOT NULL THEN NULLIF("image_url", '')
    ELSE NULL
  END;

ALTER TABLE "ads"
  ALTER COLUMN "media_url" SET NOT NULL,
  ALTER COLUMN "media_type" SET DEFAULT 'image'::"AdMediaType",
  ALTER COLUMN "media_type" SET NOT NULL;

ALTER TABLE "ads" DROP COLUMN "image_url", DROP COLUMN "video_url";
