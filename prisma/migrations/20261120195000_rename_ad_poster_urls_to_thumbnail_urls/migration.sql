-- Rename per-media ad posters to thumbnails for the video player.
-- The single poster_url column remains the front-facing carousel image.
ALTER TABLE "ads" RENAME COLUMN "poster_urls" TO "thumbnail_urls";
