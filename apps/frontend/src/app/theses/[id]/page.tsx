'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApi, Thesis, Evaluation } from '../../../lib/api';
import { EvaluationResult } from '../../../components/EvaluationResult';

export default function ThesisPage() {
  const api = useApi();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ newsHeadline: '', newsBody: '' });
  const [evaluating, setEvaluating] = useState(false);
  const [latestEvaluation, setLatestEvaluation] = useState<Evaluation | null>(null);
  const [threshold, setThreshold] = useState(70);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [thresholdSaved, setThresholdSaved] = useState(false);

  const load = async () => {
    const [t, evals] = await Promise.all([
      api.theses.get(id).catch(() => null),
      api.evaluations.listByThesis(id).catch(() => []),
    ]);
    if (!t) { router.push('/'); return; }
    setThesis(t);
    setThreshold(t.alertThreshold);
    setEvaluations(evals);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    setEvaluating(true);
    setLatestEvaluation(null);
    const result = await api.evaluations.create({
      thesisId: id,
      newsHeadline: form.newsHeadline,
      newsBody: form.newsBody || undefined,
    }).catch(() => null);
    if (result) {
      setLatestEvaluation(result);
      setEvaluations((prev) => [result, ...prev]);
      setForm({ newsHeadline: '', newsBody: '' });
    }
    setEvaluating(false);
  };

  const handleSaveThreshold = async () => {
    setSavingThreshold(true);
    const updated = await api.theses.update(id, { alertThreshold: threshold }).catch(() => null);
    if (updated) {
      setThesis(updated);
      setThresholdSaved(true);
      setTimeout(() => setThresholdSaved(false), 2000);
    }
    setSavingThreshold(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </main>
    );
  }

  if (!thesis) return null;

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 mb-6 inline-block">
          ← All theses
        </Link>

        <div className="bg-gray-900 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${thesis.direction === 'LONG' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
              {thesis.direction}
            </span>
            <h2 className="text-xl font-bold">{thesis.assetName}</h2>
            {thesis.healthScore !== null && (
              <span className={`ml-auto text-sm font-semibold px-3 py-1 rounded-lg ${
                thesis.healthScore >= 70 ? 'bg-green-500/20 text-green-400' :
                thesis.healthScore >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                                           'bg-red-500/20 text-red-400'
              }`}>
                Health {thesis.healthScore}/100
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">{thesis.thesisText}</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-6 mb-8">
          <h3 className="font-semibold text-gray-200 mb-1">Alert threshold</h3>
          <p className="text-xs text-gray-500 mb-4">
            You will receive an email alert when an automated evaluation reaches this confidence level or higher.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <span className="text-sm font-mono w-12 text-center">{threshold}%</span>
            <button
              onClick={handleSaveThreshold}
              disabled={savingThreshold || threshold === thesis.alertThreshold}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium"
            >
              {thresholdSaved ? 'Saved ✓' : savingThreshold ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-6 mb-8">
          <h3 className="font-semibold text-gray-200 mb-4">Test news against this thesis</h3>
          <form onSubmit={handleEvaluate} className="space-y-3">
            <input
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="News headline"
              value={form.newsHeadline}
              onChange={(e) => setForm((f) => ({ ...f, newsHeadline: e.target.value }))}
              required
            />
            <textarea
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
              placeholder="News body (optional — paste the full article for better accuracy)"
              value={form.newsBody}
              onChange={(e) => setForm((f) => ({ ...f, newsBody: e.target.value }))}
            />
            <button
              type="submit"
              disabled={evaluating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium"
            >
              {evaluating ? 'Evaluating...' : 'Run Evaluation'}
            </button>
          </form>

          {latestEvaluation && (
            <div className="mt-6">
              <p className="text-xs text-gray-500 mb-2">Latest result</p>
              <EvaluationResult evaluation={latestEvaluation} />
            </div>
          )}
        </div>

        {evaluations.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-200 mb-4">Evaluation history</h3>
            <div className="space-y-3">
              {evaluations.map((ev) => (
                <EvaluationResult key={ev.id} evaluation={ev} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
