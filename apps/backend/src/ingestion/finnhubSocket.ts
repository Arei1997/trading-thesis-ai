import WebSocket from 'ws';
import { NormalisedSignal } from './types';
import { processSignal } from './signalProcessor';

const API_KEY = process.env.FINNHUB_API_KEY;
const WS_URL = `wss://ws.finnhub.io?token=${API_KEY}`;
const RECONNECT_DELAY_MS = 5000;

interface FinnhubNewsItem {
  type: string;
  data: {
    category: string;
    datetime: number;
    headline: string;
    id: number;
    image: string;
    related: string;
    source: string;
    summary: string;
    url: string;
  }[];
}

const normalise = (item: FinnhubNewsItem['data'][number]): NormalisedSignal => ({
  headline: item.headline,
  body: item.summary ?? '',
  publishedAt: new Date(item.datetime * 1000).toISOString(),
  source: item.source ?? 'Finnhub',
  tickers: item.related ? item.related.split(',').map((t) => t.trim()) : [],
  url: item.url,
});

const connect = () => {
  if (!API_KEY) {
    console.warn('[finnhub] FINNHUB_API_KEY not set — skipping');
    return;
  }

  const ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log('[finnhub] WebSocket connected');
    ws.send(JSON.stringify({ type: 'subscribe', symbol: 'GENERAL:^NEWS' }));
  });

  ws.on('message', async (raw) => {
    try {
      const msg: FinnhubNewsItem = JSON.parse(raw.toString());
      if (msg.type !== 'news' || !msg.data?.length) return;

      for (const item of msg.data) {
        await processSignal(normalise(item));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[finnhub] message error:', message);
    }
  });

  ws.on('error', (err) => {
    console.error('[finnhub] WebSocket error:', err.message);
  });

  ws.on('close', () => {
    console.warn(`[finnhub] disconnected — reconnecting in ${RECONNECT_DELAY_MS / 1000}s`);
    setTimeout(connect, RECONNECT_DELAY_MS);
  });
};

export const startFinnhubSocket = () => {
  connect();
};
