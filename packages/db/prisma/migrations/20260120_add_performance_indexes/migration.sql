-- CreateIndex
-- For public job listings sorted by published date
CREATE INDEX "Job_publishedAt_status_idx" ON "Job"("publishedAt", "status");

-- CreateIndex
-- For organization audit logs filtered by entity type, sorted by date
-- This composite index optimizes queries like: "get all audit logs for org X of type Y sorted by date"
CREATE INDEX "AuditLog_orgId_entityType_createdAt_idx" ON "AuditLog"("orgId", "entityType", "createdAt");
