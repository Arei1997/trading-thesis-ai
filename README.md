# Trading Thesis AI

An AI-powered assistant that monitors your trading positions and alerts you when news events support or threaten your thesis.

You write down why you are in a trade. The system watches financial news 24/7 — from multiple live sources — and tells you when something relevant happens, with a structured AI assessment, confidence score, and suggested action.

---

## What it does

- Store a thesis per position (e.g. *"Long oil — Middle East supply shock thesis"*)
- Automatically ingests live news from **Polygon.io**, **Finnhub WebSocket**, and **RSS feeds**
- Deduplicates signals across sources and matches them to relevant theses
- Runs LLM evaluations automatically in the background via a job queue
- Sends email alerts when a high-confidence evaluation is produced
- Manually evaluate any news headline against a thesis at any time
- Browse the live signal feed and filter evaluation history across all theses
- Set a per-thesis alert threshold — only get emailed when confidence meets your bar

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | Node.js + TypeScript + Express |
| Database | PostgreSQL + Prisma ORM |
| LLM | Anthropic Claude API (structured output via tool use) |
| Frontend | Next.js 14 + React + Tailwind CSS |
| Queue | BullMQ + Redis (Upstash) |
| Email | Resend |
| Monorepo | pnpm workspaces + Turborepo |

---

## Project Structure

```
TradingThesisAI/
├── apps/
│   ├── backend/
│   │   ├── prisma/             ← schema + migrations + seed
│   │   └── src/
│   │       ├── ingestion/      ← Polygon poller, Finnhub WS, RSS poller, signal processor
│   │       ├── lib/            ← Prisma client, Redis, BullMQ queue
│   │       ├── prompts/        ← versioned LLM prompts
│   │       ├── routes/         ← Express route handlers
│   │       ├── services/       ← business logic
│   │       └── workers/        ← BullMQ evaluation worker
│   └── frontend/
│       └── src/
│           ├── app/            ← Next.js pages (theses, signals, evaluations)
│           ├── components/     ← UI components
│           └── lib/            ← API client
├── packages/
│   └── tsconfig/               ← shared TypeScript config
├── DEVLOG.md                   ← step-by-step build log
└── .env.example
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- PostgreSQL 15+ running locally
- Redis instance — [Upstash](https://upstash.com) free tier works, or run locally

### 1. Clone and install

```bash
git clone https://github.com/Arei1997/trading-thesis-ai.git
cd trading-thesis-ai
pnpm install
```

### 2. Environment variables

```bash
cp .env.example apps/backend/.env
```

Edit `apps/backend/.env`:

```
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/trading_thesis_ai"
ANTHROPIC_API_KEY="sk-ant-..."
REDIS_URL="rediss://default:password@your-upstash-url.upstash.io:6379"
POLYGON_API_KEY="your-polygon-api-key"
FINNHUB_API_KEY="your-finnhub-api-key"
RESEND_API_KEY="re_..."          # optional — alerts are skipped if absent
PORT=3001
NODE_ENV=development
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### 3. Database setup

```bash
cd apps/backend
npx prisma migrate dev --name init
npx prisma db seed
```

### 4. Run

Open two terminals:

```bash
# Terminal 1 — backend
cd apps/backend
pnpm dev

# Terminal 2 — frontend
cd apps/frontend
pnpm dev
```

Open `http://localhost:3000`.

### 5. Inspect the database

Run Prisma Studio for a visual browser of all tables:

```bash
cd apps/backend
pnpm prisma studio
```

Open `http://localhost:5555`. You can browse `theses`, `evaluations`, and `signals`, edit rows, and filter data.

Alternatively, use psql directly:

```bash
psql -U postgres -d trading_thesis_ai

# useful queries
SELECT id, user_id, asset_name, status FROM theses;
SELECT * FROM evaluations ORDER BY created_at DESC LIMIT 10;
\dt   -- list all tables
\q    -- quit
```

---

## How the pipeline works

```
Polygon.io (REST, 60s)  ─┐
Finnhub (WebSocket)      ├─► Signal Processor ─► BullMQ Queue ─► LLM Evaluator ─► Email Alert
RSS Feeds (5min)         ─┘        │
                                   └─► Signals table (deduplicated)
```

1. Three ingestion sources normalise news into a common `NormalisedSignal` shape
2. The signal processor SHA-256 deduplicates via Redis and matches signals to active theses
3. Matched signals are dispatched to BullMQ (concurrency 3, retries 3×)
4. The evaluation worker calls the Anthropic API with a structured tool-use prompt
5. If `confidence >= thesis.alertThreshold`, an email is sent via Resend

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/health/pipeline` | Pipeline component status |
| `POST` | `/theses` | Create a thesis |
| `GET` | `/theses` | List all theses |
| `GET` | `/theses/:id` | Get a thesis |
| `PATCH` | `/theses/:id` | Update a thesis (including `alertThreshold`) |
| `DELETE` | `/theses/:id` | Soft delete a thesis |
| `POST` | `/evaluate` | Run a manual LLM evaluation |
| `GET` | `/evaluate/:thesisId` | List evaluations for a thesis |
| `GET` | `/evaluations` | List all evaluations (filterable) |
| `GET` | `/signals` | List recent signals |

---

## Evaluation Response

```json
{
  "impactDirection": "SUPPORTS",
  "confidence": 82,
  "reasoning": "The OPEC production cut extension directly reduces supply, supporting the long oil thesis. This is a fundamental catalyst aligned with the original thesis reasoning.",
  "suggestedAction": "HOLD",
  "keyRiskFactors": [
    "Demand-side weakness could offset supply cuts",
    "Compliance risk among OPEC members",
    "USD strength may cap oil price upside"
  ]
}
```

---

## Roadmap

| MVP | Status | Scope |
|-----|--------|-------|
| MVP 1 | Complete | Thesis CRUD + manual LLM evaluation |
| MVP 2 | Complete | Live news ingestion, signal pipeline, email alerts, signal feed UI |
| MVP 3 | In progress | Auth (Clerk), thesis health scores, multi-channel alerts |
| MVP 4 | Planned | Broker integration, price correlation, AI thesis suggestions |

---

## Dev Log

See [DEVLOG.md](DEVLOG.md) for a detailed step-by-step explanation of every architectural decision made during the build.
