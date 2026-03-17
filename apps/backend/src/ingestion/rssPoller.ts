import Parser from 'rss-parser';
import { NormalisedSignal } from './types';
import { processSignal } from './signalProcessor';

const POLL_INTERVAL_MS = 300_000;

const FEEDS = [
  { url: 'https://feeds.reuters.com/reuters/businessNews', source: 'Reuters' },
  { url: 'https://feeds.ft.com/rss/home/uk', source: 'Financial Times' },
  { url: 'https://www.investing.com/rss/news.rss', source: 'Investing.com' },
];

const parser = new Parser();

const pollFeed = async (feedUrl: string, source: string): Promise<void> => {
  const feed = await parser.parseURL(feedUrl);

  for (const item of feed.items ?? []) {
    if (!item.title) continue;

    const signal: NormalisedSignal = {
      headline: item.title,
      body: item.contentSnippet ?? item.content ?? '',
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      source,
      tickers: [],
      url: item.link ?? '',
    };

    await processSignal(signal);
  }
};

const pollAll = async () => {
  for (const feed of FEEDS) {
    try {
      await pollFeed(feed.url, feed.source);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[rss] error polling ${feed.source}:`, message);
    }
  }
};

export const startRssPoller = () => {
  console.log('[rss] poller started — interval 5m');
  pollAll();
  setInterval(pollAll, POLL_INTERVAL_MS);
};
