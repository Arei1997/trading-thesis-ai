import { ImpactDirection } from '@prisma/client';
import { db } from '../lib/db';

interface ListParams {
  thesisId?: string;
  impactDirection?: ImpactDirection;
  from?: string;
  to?: string;
  limit?: number;
}

const list = (params: ListParams = {}) => {
  return db.evaluation.findMany({
    where: {
      ...(params.thesisId && { thesisId: params.thesisId }),
      ...(params.impactDirection && { impactDirection: params.impactDirection }),
      ...(params.from || params.to
        ? {
            createdAt: {
              ...(params.from && { gte: new Date(params.from) }),
              ...(params.to && { lte: new Date(params.to) }),
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: params.limit ?? 100,
    include: { thesis: { select: { assetName: true, direction: true } } },
  });
};

export const evaluationsService = { list };
