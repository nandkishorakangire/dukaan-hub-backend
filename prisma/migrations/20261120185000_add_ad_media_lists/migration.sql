-- Status ads can carry an ordered list of media items inside one carousel tile.
-- Keep media_url as the first item so existing consumers keep working.
ALTER TABLE "ads"
  ADD COLUMN "media_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "poster_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "ads"
SET
  "media_urls" = ARRAY["media_url"],
  "poster_urls" = CASE
    WHEN "poster_url" IS NULL THEN ARRAY[]::TEXT[]
    ELSE ARRAY["poster_url"]
  END;
