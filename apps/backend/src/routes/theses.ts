import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { thesisService } from '../services/thesisService';
import { Direction, ThesisStatus } from '@prisma/client';

export const thesesRouter = Router();

const createSchema = z.object({
  assetName: z.string().min(1),
  direction: z.nativeEnum(Direction),
  thesisText: z.string().min(10),
  userId: z.string().uuid(),
});

const updateSchema = z.object({
  assetName: z.string().min(1).optional(),
  direction: z.nativeEnum(Direction).optional(),
  thesisText: z.string().min(10).optional(),
  status: z.nativeEnum(ThesisStatus).optional(),
  alertThreshold: z.number().int().min(0).max(100).optional(),
});

thesesRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const thesis = await thesisService.create(parsed.data);
  res.status(201).json(thesis);
});

thesesRouter.get('/', async (_req: Request, res: Response) => {
  const theses = await thesisService.getAll();
  res.json(theses);
});

thesesRouter.get('/:id', async (req: Request, res: Response) => {
  const thesis = await thesisService.getById(req.params.id);
  if (!thesis) {
    res.status(404).json({ error: 'Thesis not found' });
    return;
  }
  res.json(thesis);
});

thesesRouter.patch('/:id', async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const thesis = await thesisService.update(req.params.id, parsed.data);
  if (!thesis) {
    res.status(404).json({ error: 'Thesis not found' });
    return;
  }
  res.json(thesis);
});

thesesRouter.delete('/:id', async (req: Request, res: Response) => {
  const thesis = await thesisService.softDelete(req.params.id);
  if (!thesis) {
    res.status(404).json({ error: 'Thesis not found' });
    return;
  }
  res.json(thesis);
});
