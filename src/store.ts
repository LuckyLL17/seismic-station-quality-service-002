import { randomUUID } from 'node:crypto';
import type { IngestBatchRecord, Observation, QualityReport, Station } from './types.js';

export const stations: Station[] = [
  { id: 'st-001', code: 'QZ-A01', name: '青岚台站', region: '川西断裂带', elevationM: 1840, status: 'online', lastSeenAt: new Date().toISOString() },
  { id: 'st-002', code: 'QZ-B07', name: '白石台站', region: '龙门山南段', elevationM: 920, status: 'online', lastSeenAt: new Date().toISOString() },
  { id: 'st-003', code: 'QZ-C12', name: '岷江台站', region: '岷江河谷', elevationM: 2470, status: 'maintenance', lastSeenAt: new Date().toISOString() }
];
export const observations: Observation[] = [];
export const reports: QualityReport[] = [];
export const batches = new Map<string, IngestBatchRecord>();
export function createReport(stationId: string, start: string, end: string): QualityReport {
  const rows = observations.filter(item => item.stationId === stationId && item.observedAt >= start && item.observedAt <= end);
  const averageScore = rows.length ? Math.round(rows.reduce((sum, item) => sum + item.qualityScore, 0) / rows.length) : 0;
  const issues = [...new Set(rows.flatMap(item => item.issues))];
  const report = { id: randomUUID(), stationId, windowStart: start, windowEnd: end, observationCount: rows.length, averageScore, issues, generatedAt: new Date().toISOString() };
  reports.push(report); return report;
}
