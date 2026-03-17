-- AlterTable
ALTER TABLE "theses" ADD COLUMN     "alert_threshold" INTEGER NOT NULL DEFAULT 70;

-- CreateTable
CREATE TABLE "signals" (
    "id" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT,
    "source" TEXT NOT NULL,
    "tickers" TEXT[],
    "url" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signals_pkey" PRIMARY KEY ("id")
);
