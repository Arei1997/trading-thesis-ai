import { Worker } from 'bullmq';
import { redis } from '../lib/redis';
import { EvaluationJobData } from '../lib/queue';
import { evaluationService } from '../services/evaluationService';

export const evaluationWorker = new Worker<EvaluationJobData>(
  'evaluation',
  async (job) => {
    const { thesisId, newsHeadline, newsBody } = job.data;
    console.log(`[worker] processing job ${job.id} — thesis ${thesisId}`);

    const result = await evaluationService.evaluate({ thesisId, newsHeadline, newsBody });
    if (!result) {
      console.warn(`[worker] thesis ${thesisId} not found — skipping`);
      return;
    }

    console.log(`[worker] evaluation complete — ${result.impactDirection} (${result.confidence}%)`);
    return result;
  },
  {
    connection: redis,
    concurrency: 3,
  },
);

evaluationWorker.on('failed', (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message);
});
