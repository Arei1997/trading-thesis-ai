# Trading Thesis AI

An AI-powered assistant that monitors your trading positions and alerts you when news events support or threaten your thesis.

You write down why you are in a trade. The system watches financial news and tells you when something relevant happens — with a structured assessment, confidence score, and suggested action.

---

## What it does

- Store a thesis per position (e.g. *"Long oil — Middle East supply shock thesis"*)
- Paste a news headline and body to evaluate it against any thesis
- Receive a structured AI assessment: **SUPPORTS / WEAKENS / NEUTRAL**
- See confidence score, reasoning, suggested action, and key risk factors
- Full evaluation history per thesis

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | Node.js + TypeScript + Express |
| Database | PostgreSQL + Prisma ORM |
| LLM | Anthropic Claude API (structured output via tool use) |
| Frontend | Next.js 14 + React + Tailwind CSS |
| Monorepo | pnpm workspaces + Turborepo |

---

## Project Structure

```
TradingThesisAI/
├── apps/
│   ├── backend/
│   │   ├── prisma/             ← schema + migrations + seed
│   │   └── src/
│   │       ├── lib/            ← Prisma client
│   │       ├── prompts/        ← versioned LLM prompts
│   │       ├── routes/         ← Express route handlers
│   │       └── services/       ← business logic
│   └── frontend/
│       └── src/
│           ├── app/            ← Next.js pages
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

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/theses` | Create a thesis |
| `GET` | `/theses` | List all theses |
| `GET` | `/theses/:id` | Get a thesis |
| `PATCH` | `/theses/:id` | Update a thesis |
| `DELETE` | `/theses/:id` | Soft delete a thesis |
| `POST` | `/evaluate` | Run an LLM evaluation |
| `GET` | `/evaluate/:thesisId` | List evaluations for a thesis |

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
| MVP 2 | Planned | Live news ingestion — Polygon.io, Finnhub, RSS feeds |
| MVP 3 | Planned | Dashboard, thesis health scores, multi-channel alerts, auth |
| MVP 4 | Planned | Broker integration, price correlation, AI thesis suggestions |

---

## Dev Log

See [DEVLOG.md](DEVLOG.md) for a detailed step-by-step explanation of every architectural decision made during the build.
