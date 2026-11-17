-- CreateEnum
CREATE TYPE "SavedPaymentMethodKind" AS ENUM ('upi', 'card', 'netbanking', 'wallet');

-- CreateEnum
CREATE TYPE "EmailChangeStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "first_name" TEXT,
ADD COLUMN "middle_name" TEXT,
ADD COLUMN "last_name" TEXT,
ADD COLUMN "roles" "Role"[] NOT NULL DEFAULT ARRAY['buyer']::"Role"[];

-- Existing accounts keep exactly the role they already had.
UPDATE "users" SET "roles" = ARRAY["role"];

-- Split the composed display name into first, middle and last parts.
UPDATE "users" SET
  "first_name" = split.parts[1],
  "middle_name" = CASE
    WHEN array_length(split.parts, 1) > 2
      THEN array_to_string(split.parts[2:array_length(split.parts, 1) - 1], ' ')
    ELSE NULL
  END,
  "last_name" = CASE
    WHEN array_length(split.parts, 1) > 1
      THEN split.parts[array_length(split.parts, 1)]
    ELSE NULL
  END
FROM (
  SELECT "id", regexp_split_to_array(trim("name"), '\s+') AS "parts"
  FROM "users"
  WHERE trim("name") <> ''
) AS split
WHERE "users"."id" = split."id";

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "saved_method_id" UUID;

-- CreateTable
CREATE TABLE "saved_payment_methods" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "SavedPaymentMethodKind" NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "provider" TEXT,
    "brand" TEXT,
    "last4" TEXT,
    "expiry" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_change_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "current_email" TEXT NOT NULL,
    "new_email" TEXT NOT NULL,
    "status" "EmailChangeStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_payment_methods_user_id_idx" ON "saved_payment_methods"("user_id");

-- CreateIndex
CREATE INDEX "email_change_requests_user_id_idx" ON "email_change_requests"("user_id");

-- CreateIndex
CREATE INDEX "email_change_requests_status_idx" ON "email_change_requests"("status");

-- CreateIndex
CREATE INDEX "payments_saved_method_id_idx" ON "payments"("saved_method_id");

-- AddForeignKey
ALTER TABLE "saved_payment_methods" ADD CONSTRAINT "saved_payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_change_requests" ADD CONSTRAINT "email_change_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_change_requests" ADD CONSTRAINT "email_change_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_saved_method_id_fkey" FOREIGN KEY ("saved_method_id") REFERENCES "saved_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
