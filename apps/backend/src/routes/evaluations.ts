import { Router, Request, Response } from 'express';
import { ImpactDirection } from '@prisma/client';
import { evaluationsService } from '../services/evaluationsService';
import { requireAuth } from '../middleware/requireAuth';

export const evaluationsRouter = Router();

evaluationsRouter.use(requireAuth);

evaluationsRouter.get('/', async (req: Request, res: Response) => {
  const { thesisId, impactDirection, from, to, limit } = req.query;

  const evaluations = await evaluationsService.list({
    thesisId: thesisId as string | undefined,
    impactDirection: impactDirection as ImpactDirection | undefined,
    from: from as string | undefined,
    to: to as string | undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined,
  });

  res.json(evaluations);
});
