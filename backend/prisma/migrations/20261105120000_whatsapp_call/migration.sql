-- "Call us on WhatsApp": the shop's number and whether SMS campaigns carry the link
ALTER TABLE "Shop" ADD COLUMN "waCallNumber" TEXT;
ALTER TABLE "Shop" ADD COLUMN "waCallInSms" BOOLEAN NOT NULL DEFAULT false;
