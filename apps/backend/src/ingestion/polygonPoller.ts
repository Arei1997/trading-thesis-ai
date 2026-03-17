import axios from 'axios';
import { NormalisedSignal } from './types';
import { processSignal } from './signalProcessor';

const API_KEY = process.env.POLYGON_API_KEY;
const POLL_INTERVAL_MS = 60_000;

interface PolygonArticle {
  title: string;
  description: string;
  published_utc: string;
  publisher: { name: string };
  tickers: string[];
  article_url: string;
}

let lastPublishedAt: string | null = null;

const fetchLatestNews = async (): Promise<NormalisedSignal[]> => {
  const params: Record<string, string> = {
    limit: '20',
    order: 'desc',
    sort: 'published_utc',
    apiKey: API_KEY!,
  };

  if (lastPublishedAt) {
    params['published_utc.gt'] = lastPublishedAt;
  }

  const { data } = await axios.get('https://api.polygon.io/v2/reference/news', { params });

  return (data.results ?? []).map((article: PolygonArticle): NormalisedSignal => ({
    headline: article.title,
    body: article.description ?? '',
    publishedAt: article.published_utc,
    source: article.publisher?.name ?? 'Polygon.io',
    tickers: article.tickers ?? [],
    url: article.article_url,
  }));
};

const poll = async () => {
  if (!API_KEY) {
    console.warn('[polygon] POLYGON_API_KEY not set — skipping');
    return;
  }

  try {
    const signals = await fetchLatestNews();
    if (signals.length === 0) return;

    lastPublishedAt = signals[0].publishedAt;

    for (const signal of signals) {
      await processSignal(signal);
    }

    console.log(`[polygon] processed ${signals.length} articles`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[polygon] poll error:', message);
  }
};

export const startPolygonPoller = () => {
  console.log('[polygon] poller started — interval 60s');
  poll();
  setInterval(poll, POLL_INTERVAL_MS);
};
