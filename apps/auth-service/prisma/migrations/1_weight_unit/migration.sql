-- CreateEnum
CREATE TYPE "WeightUnit" AS ENUM ('kg', 'lb');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "weightUnit" "WeightUnit" NOT NULL DEFAULT 'kg';

