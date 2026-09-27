export type Station = { id: string; code: string; name: string; region: string; elevationM: number; status: 'online' | 'maintenance' | 'offline'; lastSeenAt: string };
export type Observation = { id: string; stationId: string; observedAt: string; samples: number; sampleRateHz: number; peakAmplitude: number; timingOffsetMs: number; qualityScore: number; issues: string[]; batchId?: string };
export type QualityReport = { id: string; stationId: string; windowStart: string; windowEnd: string; observationCount: number; averageScore: number; issues: string[]; generatedAt: string };
export type ObservationReject = { index: number; errors: string[] };
export type IngestBatchResult = { batchId: string; total: number; accepted: number; rejected: number; observations: Observation[]; rejects: ObservationReject[]; processedAt: string };
export type IngestBatchRecord = { payloadHash: string; result: IngestBatchResult };
