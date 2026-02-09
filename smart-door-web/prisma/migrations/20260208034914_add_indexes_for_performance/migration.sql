-- CreateIndex
CREATE INDEX "access_logs_created_at_idx" ON "access_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "access_logs_uid_idx" ON "access_logs"("uid");

-- CreateIndex
CREATE INDEX "system_events_created_at_idx" ON "system_events"("created_at" DESC);
