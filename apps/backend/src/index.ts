import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { thesesRouter } from './routes/theses';
import { evaluateRouter } from './routes/evaluate';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/theses', thesesRouter);
app.use('/evaluate', evaluateRouter);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

export default app;
