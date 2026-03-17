-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "ThesisStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ImpactDirection" AS ENUM ('SUPPORTS', 'WEAKENS', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "SuggestedAction" AS ENUM ('HOLD', 'REVIEW', 'CONSIDER_CLOSING');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "theses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "asset_name" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "thesis_text" TEXT NOT NULL,
    "status" "ThesisStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "theses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "thesis_id" TEXT NOT NULL,
    "news_headline" TEXT NOT NULL,
    "news_body" TEXT,
    "impact_direction" "ImpactDirection" NOT NULL,
    "confidence" INTEGER NOT NULL,
    "reasoning" TEXT NOT NULL,
    "suggested_action" "SuggestedAction" NOT NULL,
    "key_risk_factors" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "theses" ADD CONSTRAINT "theses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_thesis_id_fkey" FOREIGN KEY ("thesis_id") REFERENCES "theses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
