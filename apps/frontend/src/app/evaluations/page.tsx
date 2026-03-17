'use client';

import { useEffect, useState } from 'react';
import { api, EvaluationWithThesis, ImpactDirection } from '../../lib/api';

const impactColour: Record<ImpactDirection, string> = {
  SUPPORTS: 'text-green-400',
  WEAKENS: 'text-red-400',
  NEUTRAL: 'text-gray-400',
};

const impactBg: Record<ImpactDirection, string> = {
  SUPPORTS: 'bg-green-500/10 border-green-500/30',
  WEAKENS: 'bg-red-500/10 border-red-500/30',
  NEUTRAL: 'bg-gray-700/30 border-gray-600/30',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function EvaluationsPage() {
  const [evaluations, setEvaluations] = useState<EvaluationWithThesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{
    impactDirection: ImpactDirection | '';
    from: string;
    to: string;
  }>({ impactDirection: '', from: '', to: '' });

  const load = async () => {
    setLoading(true);
    const data = await api.evaluations
      .list({
        impactDirection: filters.impactDirection || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        limit: 100,
      })
      .catch(() => [] as EvaluationWithThesis[]);
    setEvaluations(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-8">Evaluation History</h1>

        <form onSubmit={handleFilter} className="bg-gray-900 rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Impact</label>
            <select
              className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.impactDirection}
              onChange={(e) => setFilters((f) => ({ ...f, impactDirection: e.target.value as ImpactDirection | '' }))}
            >
              <option value="">All</option>
              <option value="SUPPORTS">Supports</option>
              <option value="WEAKENS">Weakens</option>
              <option value="NEUTRAL">Neutral</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">From</label>
            <input
              type="date"
              className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">To</label>
            <input
              type="date"
              className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters({ impactDirection: '', from: '', to: '' });
              setTimeout(load, 0);
            }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium"
          >
            Clear
          </button>
        </form>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : evaluations.length === 0 ? (
          <p className="text-gray-500 text-sm">No evaluations match the selected filters.</p>
        ) : (
          <div className="space-y-3">
            {evaluations.map((ev) => (
              <div key={ev.id} className={`rounded-xl p-4 border ${impactBg[ev.impactDirection]}`}>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <span className="text-xs text-gray-400">
                      {ev.thesis.assetName} · {ev.thesis.direction}
                    </span>
                    <p className="text-sm font-medium text-white mt-0.5">{ev.newsHeadline}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${impactColour[ev.impactDirection]}`}>
                      {ev.impactDirection}
                    </p>
                    <p className="text-xs text-gray-400">{ev.confidence}% confidence</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{ev.reasoning}</p>
                <p className="text-xs text-gray-600 mt-2">{fmt(ev.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
