const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const DEMO_USER_ID = 'a0000000-0000-0000-0000-000000000001';

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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const api = {
  theses: {
    list: () => request<Thesis[]>('/theses'),
    get: (id: string) => request<Thesis>(`/theses/${id}`),
    create: (data: { assetName: string; direction: Direction; thesisText: string }) =>
      request<Thesis>('/theses', {
        method: 'POST',
        body: JSON.stringify({ ...data, userId: DEMO_USER_ID }),
      }),
    update: (id: string, data: Partial<Pick<Thesis, 'assetName' | 'direction' | 'thesisText' | 'status'>>) =>
      request<Thesis>(`/theses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<Thesis>(`/theses/${id}`, { method: 'DELETE' }),
  },
  evaluations: {
    listByThesis: (thesisId: string) => request<Evaluation[]>(`/evaluate/${thesisId}`),
    create: (data: { thesisId: string; newsHeadline: string; newsBody?: string }) =>
      request<Evaluation>('/evaluate', { method: 'POST', body: JSON.stringify(data) }),
  },
};
