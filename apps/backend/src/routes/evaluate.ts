import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { evaluationService } from '../services/evaluationService';

export const evaluateRouter = Router();

const evaluateSchema = z.object({
  thesisId: z.string().uuid(),
  newsHeadline: z.string().min(1),
  newsBody: z.string().optional(),
});

evaluateRouter.post('/', async (req: Request, res: Response) => {
  const parsed = evaluateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const evaluation = await evaluationService.evaluate(parsed.data);
  if (!evaluation) {
    res.status(404).json({ error: 'Thesis not found' });
    return;
  }

  res.status(201).json(evaluation);
});

evaluateRouter.get('/:thesisId', async (req: Request, res: Response) => {
  const evaluations = await evaluationService.getByThesis(req.params.thesisId);
  res.json(evaluations);
});
