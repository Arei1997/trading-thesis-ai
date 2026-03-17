import { Queue } from 'bullmq';
import { redis } from './redis';

export interface EvaluationJobData {
  thesisId: string;
  newsHeadline: string;
  newsBody?: string;
  source: string;
}

export const evaluationQueue = new Queue<EvaluationJobData>('evaluation', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});
