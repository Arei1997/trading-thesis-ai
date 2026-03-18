import { Direction, ImpactDirection, ThesisStatus } from '@prisma/client';
import { db } from '../lib/db';

interface CreateThesisInput {
  userId: string;
  assetName: string;
  direction: Direction;
  thesisText: string;
}

interface UpdateThesisInput {
  assetName?: string;
  direction?: Direction;
  thesisText?: string;
  status?: ThesisStatus;
  alertThreshold?: number;
}

function computeHealthScore(
  evaluations: { impactDirection: ImpactDirection; confidence: number }[],
): number | null {
  if (!evaluations.length) return null;
  const sum = evaluations.reduce((acc, ev) => {
    const m = ev.impactDirection === 'SUPPORTS' ? 1 : ev.impactDirection === 'WEAKENS' ? -1 : 0;
    return acc + m * ev.confidence;
  }, 0);
  // raw is in [-100, +100]; map to [0, 100]
  return Math.round((sum / evaluations.length + 100) / 2);
}

const HEALTH_INCLUDE = {
  evaluations: {
    orderBy: { createdAt: 'desc' as const },
    take: 10,
    select: { impactDirection: true, confidence: true },
  },
};

const create = (data: CreateThesisInput) => {
  return db.thesis.create({ data });
};

const getAll = async (userId: string) => {
  const theses = await db.thesis.findMany({
    where: { status: { not: 'CLOSED' }, userId },
    orderBy: { createdAt: 'desc' },
    include: HEALTH_INCLUDE,
  });
  return theses.map(({ evaluations, ...thesis }) => ({
    ...thesis,
    healthScore: computeHealthScore(evaluations),
  }));
};

const getById = async (id: string) => {
  const thesis = await db.thesis.findUnique({
    where: { id },
    include: HEALTH_INCLUDE,
  });
  if (!thesis) return null;
  const { evaluations, ...rest } = thesis;
  return { ...rest, healthScore: computeHealthScore(evaluations) };
};

const update = (id: string, data: UpdateThesisInput) => {
  return db.thesis.update({ where: { id }, data }).catch(() => null);
};

const softDelete = (id: string) => {
  return db.thesis
    .update({ where: { id }, data: { status: ThesisStatus.CLOSED } })
    .catch(() => null);
};

export const thesisService = { create, getAll, getById, update, softDelete };
