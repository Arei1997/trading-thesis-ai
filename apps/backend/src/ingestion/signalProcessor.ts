import { createHash } from 'crypto';
import { redis } from '../lib/redis';
import { evaluationQueue } from '../lib/queue';
import { db } from '../lib/db';
import { NormalisedSignal } from './types';

const DEDUP_TTL_SECONDS = 3600;

const isDuplicate = async (signal: NormalisedSignal): Promise<boolean> => {
  const hash = createHash('sha256')
    .update(`${signal.source}:${signal.headline}`)
    .digest('hex');

  const key = `dedup:${hash}`;
  const existing = await redis.get(key);
  if (existing) return true;

  await redis.setex(key, DEDUP_TTL_SECONDS, '1');
  return false;
};

const findMatchingTheses = async (signal: NormalisedSignal) => {
  const theses = await db.thesis.findMany({ where: { status: 'ACTIVE' } });

  return theses.filter((thesis) => {
    const assetLower = thesis.assetName.toLowerCase();
    const headlineLower = signal.headline.toLowerCase();
    const bodyLower = signal.body.toLowerCase();
    const tickerMatch = signal.tickers.some(
      (t) => assetLower.includes(t.toLowerCase()) || t.toLowerCase().includes(assetLower),
    );
    const textMatch = headlineLower.includes(assetLower) || bodyLower.includes(assetLower);
    return tickerMatch || textMatch;
  });
};

export const processSignal = async (signal: NormalisedSignal): Promise<void> => {
  if (await isDuplicate(signal)) return;

  await db.signal.create({
    data: {
      headline: signal.headline,
      body: signal.body || null,
      source: signal.source,
      tickers: signal.tickers,
      url: signal.url,
      publishedAt: new Date(signal.publishedAt),
    },
  });

  const matchingTheses = await findMatchingTheses(signal);
  if (matchingTheses.length === 0) return;

  for (const thesis of matchingTheses) {
    await evaluationQueue.add(
      `eval:${thesis.id}:${signal.publishedAt}`,
      {
        thesisId: thesis.id,
        newsHeadline: signal.headline,
        newsBody: signal.body,
        source: signal.source,
      },
    );
  }

  console.log(`[processor] queued ${matchingTheses.length} jobs for "${signal.headline}"`);
};
