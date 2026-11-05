-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BDT',
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'sslcommerz';

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'BD',
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BDT',
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'bn',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "uiLang" TEXT;
