-- CreateTable: ConsentRecord
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "candidateId" TEXT,
    "consentType" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "purpose" TEXT,
    "legalBasis" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "version" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DSARRequest
CREATE TABLE "DSARRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "requestType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "email" TEXT NOT NULL,
    "description" TEXT,
    "completedAt" TIMESTAMP(3),
    "responseData" JSONB,
    "rejectionReason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DSARRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WebVitalsMetric
CREATE TABLE "WebVitalsMetric" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "rating" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "metricId" TEXT NOT NULL,
    "navigationType" TEXT NOT NULL,
    "url" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebVitalsMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_consentType_idx" ON "ConsentRecord"("userId", "consentType");
CREATE INDEX "ConsentRecord_candidateId_consentType_idx" ON "ConsentRecord"("candidateId", "consentType");

-- CreateIndex
CREATE INDEX "DSARRequest_userId_idx" ON "DSARRequest"("userId");
CREATE INDEX "DSARRequest_email_idx" ON "DSARRequest"("email");
CREATE INDEX "DSARRequest_status_idx" ON "DSARRequest"("status");

-- CreateIndex
CREATE INDEX "WebVitalsMetric_name_rating_idx" ON "WebVitalsMetric"("name", "rating");
CREATE INDEX "WebVitalsMetric_timestamp_idx" ON "WebVitalsMetric"("timestamp");

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSARRequest" ADD CONSTRAINT "DSARRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
