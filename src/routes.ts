import type { FastifyInstance } from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { batches, createReport, observations, reports, stations } from './store.js';
import type { BatchIngestResult, BatchRejection, Observation, Station } from './types.js';

const ingestSchema = z.object({ stationId: z.string(), observedAt: z.string().datetime().optional(), samples: z.number().int().nonnegative(), sampleRateHz: z.number().positive(), peakAmplitude: z.number().nonnegative(), timingOffsetMs: z.number() });
const batchIngestSchema = z.object({ batchId: z.string().min(1).max(128), observations: z.array(z.unknown()).min(1).max(1000) });
const reportSchema = z.object({ stationId: z.string(), windowStart: z.string().datetime(), windowEnd: z.string().datetime() });

type IngestInput = z.infer<typeof ingestSchema>;

function buildObservation(input: IngestInput): Observation {
  const issues: string[] = [];
  if (input.samples < input.sampleRateHz * 30) issues.push('采样窗口不足');
  if (input.peakAmplitude > 0.95) issues.push('波形削顶风险');
  if (Math.abs(input.timingOffsetMs) > 5) issues.push('时间同步偏差');
  const qualityScore = Math.max(0, Math.round(100 - issues.length * 22 - Math.min(Math.abs(input.timingOffsetMs), 20)));
  return { id: randomUUID(), ...input, observedAt: input.observedAt ?? new Date().toISOString(), qualityScore, issues };
}

function touchStation(station: Station, observedAt: string) {
  if (observedAt > station.lastSeenAt) station.lastSeenAt = observedAt;
  station.status = 'online';
}

export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok', service: 'seismic-station-quality-service', workflow: '接收台站数据 → 检测完整性 → 计算质量分 → 生成质量报告' }));
  app.get('/api/stations', async () => stations);
  app.post('/api/stations', async (request, reply) => { const body = request.body as Partial<(typeof stations)[number]>; const station = { id: randomUUID(), code: body.code ?? `QZ-${stations.length + 1}`, name: body.name ?? '未命名台站', region: body.region ?? '未设置', elevationM: body.elevationM ?? 0, status: body.status ?? 'offline', lastSeenAt: new Date().toISOString() } as (typeof stations)[number]; stations.push(station); return reply.code(201).send(station); });
  app.post('/api/observations/ingest', async (request, reply) => { const parsed = ingestSchema.safeParse(request.body); if (!parsed.success) return reply.code(400).send({ error: '参数校验失败', details: parsed.error.flatten() }); const input = parsed.data; const station = stations.find(item => item.id === input.stationId); if (!station) return reply.code(404).send({ error: '台站不存在' }); const observation = buildObservation(input); observations.push(observation); touchStation(station, observation.observedAt); return reply.code(201).send(observation); });
  app.post('/api/observations/ingest/batch', async (request, reply) => {
    const parsed = batchIngestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: '参数校验失败', details: parsed.error.flatten() });
    const { batchId, observations: items } = parsed.data;
    const payloadHash = createHash('sha256').update(JSON.stringify(items)).digest('hex');
    const existing = batches.get(batchId);
    if (existing) {
      if (existing.payloadHash !== payloadHash) return reply.code(409).send({ error: '批次标识已被使用，且批次内容不一致', batchId });
      return reply.code(200).send({ ...existing.result, replay: true });
    }
    const accepted: Observation[] = [];
    const rejected: BatchRejection[] = [];
    items.forEach((raw, index) => {
      const item = ingestSchema.safeParse(raw);
      if (!item.success) { rejected.push({ index, stationId: (raw as { stationId?: unknown })?.stationId as string | undefined, reason: '参数校验失败', details: item.error.flatten() }); return; }
      const station = stations.find(entry => entry.id === item.data.stationId);
      if (!station) { rejected.push({ index, stationId: item.data.stationId, reason: '台站不存在' }); return; }
      const observation = buildObservation(item.data);
      observations.push(observation);
      touchStation(station, observation.observedAt);
      accepted.push(observation);
    });
    const result: BatchIngestResult = { batchId, acceptedCount: accepted.length, rejectedCount: rejected.length, accepted, rejected };
    batches.set(batchId, { batchId, payloadHash, receivedAt: new Date().toISOString(), result });
    return reply.code(201).send({ ...result, replay: false });
  });
  app.get('/api/observations', async (request) => { const query = request.query as { stationId?: string; minScore?: string }; return observations.filter(item => (!query.stationId || item.stationId === query.stationId) && (!query.minScore || item.qualityScore >= Number(query.minScore))); });
  app.post('/api/quality/reports/run', async (request, reply) => { const parsed = reportSchema.safeParse(request.body); if (!parsed.success) return reply.code(400).send({ error: '参数校验失败', details: parsed.error.flatten() }); if (!stations.some(item => item.id === parsed.data.stationId)) return reply.code(404).send({ error: '台站不存在' }); return reply.code(201).send(createReport(parsed.data.stationId, parsed.data.windowStart, parsed.data.windowEnd)); });
  app.get('/api/quality/reports', async (request) => { const query = request.query as { stationId?: string }; return reports.filter(item => !query.stationId || item.stationId === query.stationId); });
}
