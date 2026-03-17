'use client';

import { Evaluation } from '../lib/api';

const impactStyles: Record<Evaluation['impactDirection'], string> = {
  SUPPORTS: 'border-green-500 bg-green-500/10 text-green-400',
  WEAKENS: 'border-red-500 bg-red-500/10 text-red-400',
  NEUTRAL: 'border-gray-500 bg-gray-500/10 text-gray-400',
};

const actionLabel: Record<Evaluation['suggestedAction'], string> = {
  HOLD: 'Hold position',
  REVIEW: 'Review position',
  CONSIDER_CLOSING: 'Consider closing',
};

export function EvaluationResult({ evaluation }: { evaluation: Evaluation }) {
  const styles = impactStyles[evaluation.impactDirection];

  return (
    <div className={`rounded-lg border p-4 ${styles}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-lg">{evaluation.impactDirection}</span>
        <div className="flex items-center gap-3 text-sm">
          <span>Confidence: <strong>{evaluation.confidence}%</strong></span>
          <span className="px-2 py-0.5 rounded bg-white/10 text-white">
            {actionLabel[evaluation.suggestedAction]}
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-300 mb-3">{evaluation.reasoning}</p>

      {evaluation.keyRiskFactors.length > 0 && (
        <ul className="text-sm space-y-1">
          {evaluation.keyRiskFactors.map((factor, i) => (
            <li key={i} className="flex gap-2 text-gray-400">
              <span>•</span>
              <span>{factor}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-gray-600 mt-3">
        {evaluation.newsHeadline} — {new Date(evaluation.createdAt).toLocaleString()}
      </p>
    </div>
  );
}
