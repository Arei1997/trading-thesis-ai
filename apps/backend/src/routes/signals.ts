import { Router, Request, Response } from 'express';
import { signalService } from '../services/signalService';
import { requireAuth } from '../middleware/requireAuth';

export const signalsRouter = Router();

signalsRouter.use(requireAuth);

signalsRouter.get('/', async (_req: Request, res: Response) => {
  const signals = await signalService.getRecent();
  res.json(signals);
});
