import { Router, Request, Response } from 'express';
import { signalService } from '../services/signalService';

export const signalsRouter = Router();

signalsRouter.get('/', async (_req: Request, res: Response) => {
  const signals = await signalService.getRecent();
  res.json(signals);
});
