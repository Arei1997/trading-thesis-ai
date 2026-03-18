'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApi, Signal } from '../../lib/api';

const sourceLabel: Record<string, string> = {
  polygon: 'Polygon',
  finnhub: 'Finnhub',
  rss: 'RSS',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function SignalsPage() {
  const api = useApi();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const data = await api.signals.list().catch(() => [] as Signal[]);
    setSignals(data);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Signal Feed</h1>
            <p className="text-sm text-gray-500 mt-1">
              Processed news — refreshes every 30s
              {lastRefresh && ` · last updated ${timeAgo(lastRefresh.toISOString())}`}
            </p>
          </div>
          <button
            onClick={load}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : signals.length === 0 ? (
          <p className="text-gray-500 text-sm">No signals yet. The pipeline will populate this once news is ingested.</p>
        ) : (
          <div className="space-y-2">
            {signals.map((signal) => (
              <div key={signal.id} className="bg-gray-900 rounded-xl p-4 hover:bg-gray-800/80 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                        {sourceLabel[signal.source] ?? signal.source}
                      </span>
                      {signal.ticker && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                          {signal.ticker}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white leading-snug">{signal.headline}</p>
                    {signal.url && (
                      <a
                        href={signal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-gray-300 mt-1 inline-block truncate max-w-xs"
                      >
                        {signal.url}
                      </a>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">
                    {timeAgo(signal.publishedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
