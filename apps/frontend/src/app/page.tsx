'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApi, Thesis, Direction } from '../lib/api';

const statusBadge: Record<Thesis['status'], string> = {
  ACTIVE: 'bg-green-500/20 text-green-400',
  PAUSED: 'bg-yellow-500/20 text-yellow-400',
  CLOSED: 'bg-gray-500/20 text-gray-500',
};

const directionBadge: Record<Direction, string> = {
  LONG: 'bg-blue-500/20 text-blue-400',
  SHORT: 'bg-orange-500/20 text-orange-400',
};

function HealthBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const colour =
    score >= 70 ? 'bg-green-500/20 text-green-400' :
    score >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400';
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${colour}`}>
      Health {score}
    </span>
  );
}

export default function Home() {
  const api = useApi();
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ assetName: '', direction: 'LONG' as Direction, thesisText: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await api.theses.list().catch(() => []);
    setTheses(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await api.theses.create(form).catch(() => null);
    setForm({ assetName: '', direction: 'LONG', thesisText: '' });
    setShowForm(false);
    await load();
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await api.theses.delete(id);
    setTheses((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Trading Thesis AI</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium"
          >
            {showForm ? 'Cancel' : '+ New Thesis'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="mb-8 bg-gray-900 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-gray-200">New Thesis</h2>
            <div className="flex gap-3">
              <input
                className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Asset name (e.g. Crude Oil WTI)"
                value={form.assetName}
                onChange={(e) => setForm((f) => ({ ...f, assetName: e.target.value }))}
                required
              />
              <select
                className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                value={form.direction}
                onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as Direction }))}
              >
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
              </select>
            </div>
            <textarea
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
              placeholder="Describe your thesis in detail — why are you in this trade?"
              value={form.thesisText}
              onChange={(e) => setForm((f) => ({ ...f, thesisText: e.target.value }))}
              required
              minLength={10}
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium"
            >
              {submitting ? 'Creating...' : 'Create Thesis'}
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : theses.length === 0 ? (
          <p className="text-gray-500 text-sm">No theses yet. Create one above.</p>
        ) : (
          <div className="space-y-3">
            {theses.map((thesis) => (
              <div key={thesis.id} className="bg-gray-900 rounded-xl p-5 hover:bg-gray-800/80 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${directionBadge[thesis.direction]}`}>
                        {thesis.direction}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusBadge[thesis.status]}`}>
                        {thesis.status}
                      </span>
                      <HealthBadge score={thesis.healthScore} />
                      <span className="font-semibold text-white">{thesis.assetName}</span>
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-2">{thesis.thesisText}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link
                      href={`/theses/${thesis.id}`}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-medium"
                    >
                      Evaluate
                    </Link>
                    <button
                      onClick={() => handleDelete(thesis.id)}
                      className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 text-red-400 rounded-lg text-xs font-medium"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
