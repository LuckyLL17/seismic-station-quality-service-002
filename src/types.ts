export type Station = { id: string; code: string; name: string; region: string; elevationM: number; status: 'online' | 'maintenance' | 'offline'; lastSeenAt: string };
export type Observation = { id: string; stationId: string; observedAt: string; samples: number; sampleRateHz: number; peakAmplitude: number; timingOffsetMs: number; qualityScore: number; issues: string[] };
export type QualityReport = { id: string; stationId: string; windowStart: string; windowEnd: string; observationCount: number; averageScore: number; issues: string[]; generatedAt: string };
export type BatchRejection = { index: number; stationId?: string; reason: string; details?: unknown };
export type BatchIngestResult = { batchId: string; acceptedCount: number; rejectedCount: number; accepted: Observation[]; rejected: BatchRejection[] };
export type IngestBatch = { batchId: string; payloadHash: string; receivedAt: string; result: BatchIngestResult };
