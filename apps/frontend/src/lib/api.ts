import { useAuth } from '@clerk/nextjs';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type Direction = 'LONG' | 'SHORT';
export type ThesisStatus = 'ACTIVE' | 'PAUSED' | 'CLOSED';
export type ImpactDirection = 'SUPPORTS' | 'WEAKENS' | 'NEUTRAL';
export type SuggestedAction = 'HOLD' | 'REVIEW' | 'CONSIDER_CLOSING';

export interface Thesis {
  id: string;
  userId: string;
  assetName: string;
  direction: Direction;
  thesisText: string;
  status: ThesisStatus;
  alertThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface Evaluation {
  id: string;
  thesisId: string;
  newsHeadline: string;
  newsBody?: string;
  impactDirection: ImpactDirection;
  confidence: number;
  reasoning: string;
  suggestedAction: SuggestedAction;
  keyRiskFactors: string[];
  createdAt: string;
}

export interface EvaluationWithThesis extends Evaluation {
  thesis: { assetName: string; direction: Direction };
}

export interface Signal {
  id: string;
  hash: string;
  source: string;
  ticker: string | null;
  headline: string;
  url: string | null;
  publishedAt: string;
  createdAt: string;
}

async function request<T>(path: string, options?: RequestInit, token?: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as unknown as T;
}

export function useApi() {
  const { getToken } = useAuth();

  async function authedRequest<T>(path: string, options?: RequestInit): Promise<T> {
    const token = await getToken();
    return request<T>(path, options, token ?? undefined);
  }

  return {
    theses: {
      list: () => authedRequest<Thesis[]>('/theses'),
      get: (id: string) => authedRequest<Thesis>(`/theses/${id}`),
      create: (data: { assetName: string; direction: Direction; thesisText: string }) =>
        authedRequest<Thesis>('/theses', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<Pick<Thesis, 'assetName' | 'direction' | 'thesisText' | 'status' | 'alertThreshold'>>) =>
        authedRequest<Thesis>(`/theses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      delete: (id: string) => authedRequest<Thesis>(`/theses/${id}`, { method: 'DELETE' }),
    },
    evaluations: {
      listByThesis: (thesisId: string) => authedRequest<Evaluation[]>(`/evaluate/${thesisId}`),
      create: (data: { thesisId: string; newsHeadline: string; newsBody?: string }) =>
        authedRequest<Evaluation>('/evaluate', { method: 'POST', body: JSON.stringify(data) }),
      list: (params?: { thesisId?: string; impactDirection?: ImpactDirection; from?: string; to?: string; limit?: number }) => {
        const qs = new URLSearchParams();
        if (params?.thesisId) qs.set('thesisId', params.thesisId);
        if (params?.impactDirection) qs.set('impactDirection', params.impactDirection);
        if (params?.from) qs.set('from', params.from);
        if (params?.to) qs.set('to', params.to);
        if (params?.limit != null) qs.set('limit', String(params.limit));
        const query = qs.toString();
        return authedRequest<EvaluationWithThesis[]>(`/evaluations${query ? `?${query}` : ''}`);
      },
    },
    signals: {
      list: () => authedRequest<Signal[]>('/signals'),
    },
  };
}
