import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getAuth } from '@clerk/express';
import { thesisService } from '../services/thesisService';
import { Direction, ThesisStatus } from '@prisma/client';
import { requireAuth } from '../middleware/requireAuth';

export const thesesRouter = Router();

thesesRouter.use(requireAuth);

const createSchema = z.object({
  assetName: z.string().min(1),
  direction: z.nativeEnum(Direction),
  thesisText: z.string().min(10),
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
  const { userId } = getAuth(req);
  const thesis = await thesisService.create({ ...parsed.data, userId: userId! });
  res.status(201).json(thesis);
});

thesesRouter.get('/', async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const theses = await thesisService.getAll(userId!);
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
  const { userId } = getAuth(req);
  const thesis = await thesisService.getById(req.params.id);
  if (!thesis) { res.status(404).json({ error: 'Thesis not found' }); return; }
  if (thesis.userId !== userId) { res.status(403).json({ error: 'Forbidden' }); return; }
  const updated = await thesisService.update(req.params.id, parsed.data);
  res.json(updated);
});

thesesRouter.delete('/:id', async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const thesis = await thesisService.getById(req.params.id);
  if (!thesis) { res.status(404).json({ error: 'Thesis not found' }); return; }
  if (thesis.userId !== userId) { res.status(403).json({ error: 'Forbidden' }); return; }
  const deleted = await thesisService.softDelete(req.params.id);
  res.json(deleted);
});
