-- CreateTable
CREATE TABLE "card_delay_schedules" (
    "id" TEXT NOT NULL,
    "card_uid" TEXT NOT NULL,
    "start_hour" INTEGER NOT NULL,
    "end_hour" INTEGER NOT NULL,
    "delay_sec" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_delay_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "card_delay_schedules_card_uid_start_hour_end_hour_key" ON "card_delay_schedules"("card_uid", "start_hour", "end_hour");
