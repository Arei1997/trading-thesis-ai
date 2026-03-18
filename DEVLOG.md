# Trading Thesis AI — Dev Log

A step-by-step build log explaining every decision made while building this project. Intended as a learning reference alongside the codebase.

---

## TTA-001 — Project Scaffolding

### What are we building?

Trading Thesis AI is a system that lets traders write down *why* they are in a trade (their thesis), then automatically monitors financial news 24/7 and alerts them when something happens that supports or weakens that thesis.

For example: you are long oil because you believe Middle East tensions will restrict supply. The system watches news feeds, and if a ceasefire is announced, it alerts you: *"This news WEAKENS your oil thesis — consider reviewing your position."*

This first PR sets up the project skeleton: the folder structure, configuration files, and the tooling that every future PR will build on top of.

---

### What is a Monorepo?

A monorepo (monolithic repository) is a single git repository that contains multiple related projects — in our case, a backend API and a frontend web app.

**Why use a monorepo?**

The alternative is two separate repos: one for the backend, one for the frontend. With separate repos you need to:
- Manage two separate git histories, CI pipelines, and dependency installs
- Publish shared code as npm packages every time you change something
- Keep versions in sync manually

With a monorepo, both apps live side by side. You can change a shared type definition and both apps see the update instantly. For a product like this — where the frontend and backend evolve together — this is a significant development speed advantage.

**Our monorepo structure:**

```
TradingThesisAI/
├── apps/
│   ├── backend/        ← Express API (Node.js + TypeScript)
│   └── frontend/       ← Next.js web app (React + TypeScript)
├── packages/
│   └── tsconfig/       ← Shared TypeScript configuration
├── package.json        ← Workspace root
├── turbo.json          ← Turborepo pipeline config
├── .gitignore
├── .env.example
└── DEVLOG.md
```

`apps/` contains the runnable applications. `packages/` contains shared internal libraries — things used by multiple apps. Right now we only have one shared package: a base TypeScript config.

---

### What is pnpm?

`pnpm` is a package manager for Node.js (like `npm` or `yarn`) with two important advantages for monorepos:

1. **Workspaces** — pnpm understands the monorepo layout. Running `pnpm install` from the root installs dependencies for all apps in one step. Packages within the monorepo can reference each other using `"@tta/tsconfig": "workspace:*"` — the `workspace:*` protocol tells pnpm to link to the local copy rather than downloading from npm.

2. **Efficiency** — pnpm stores packages in a single content-addressable store on your machine and hard-links them into each project. This means if 10 projects all use Express, it is only stored once on disk.

The `"packageManager": "pnpm@9.0.0"` field in `package.json` pins the pnpm version so every developer and CI environment uses the same one.

---

### What is Turborepo?

Turborepo is a build system for monorepos. It solves a specific problem: if you have a backend and a frontend, and you want to run `build` or `dev` for both, you need something to orchestrate that.

**turbo.json** defines the task pipeline:

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

- `"dependsOn": ["^build"]` — the `^` means "build all packages this app depends on first". So if the backend depends on `@tta/tsconfig`, Turbo builds that package before building the backend.
- `"outputs"` — Turbo caches these folders. If nothing changed, it skips the build and replays the cache. This makes CI dramatically faster.
- `"cache": false, "persistent": true` on `dev` — dev servers run forever (persistent) and should never be cached.

Running `pnpm dev` from the root triggers `turbo dev`, which starts both the backend dev server and the Next.js dev server in parallel.

---

### What is TypeScript?

TypeScript is JavaScript with a type system. You annotate variables, function parameters, and return values with types, and the TypeScript compiler (`tsc`) checks them before any code runs.

**Why does this matter for a project like this?**

Our system involves structured data passing between many layers: news articles come in, get tagged with entities, get matched against thesis objects, go to an LLM, come back as structured JSON, get written to a database, and get displayed in a UI. Without types, a typo in a field name or a wrong assumption about data shape creates a runtime bug that only appears when real data flows through the system. With types, the compiler catches these mistakes before they ever run.

**tsconfig.json** is the TypeScript compiler configuration file. We have a base config in `packages/tsconfig/base.json` that both apps extend:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

Key settings:
- `"target": "ES2022"` — compile down to ES2022 JavaScript. Node.js 20+ supports this natively.
- `"strict": true` — enables all strict type checks. This is the most important setting. It catches null/undefined errors, implicit `any` types, and other common mistakes at compile time.
- `"esModuleInterop": true` — allows `import express from 'express'` syntax for CommonJS packages that don't have ES module exports.
- `"skipLibCheck": true` — skip type-checking inside `node_modules`. Type errors in third-party packages are not your problem.

Each app has its own `tsconfig.json` that extends the base and adds app-specific settings (like JSX for the frontend).

---

### The Backend Entry Point (apps/backend/src/index.ts)

The backend is an **Express** HTTP server. Express is the most widely used Node.js web framework — it lets you define routes (URL paths) and attach handler functions to them.

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
```

**`dotenv.config()`** — reads the `.env` file and loads key=value pairs into `process.env`. This is how the app reads secrets like `ANTHROPIC_API_KEY` without them being hardcoded in source code.

**`app.use(cors())`** — Cross-Origin Resource Sharing. By default, browsers block HTTP requests from one origin (e.g. `localhost:3000`) to a different origin (e.g. `localhost:3001`). The `cors` middleware adds headers to every response that tell the browser to allow these requests. Without this, the frontend cannot call the backend API.

**`app.use(express.json())`** — parses incoming request bodies as JSON. Without this, `req.body` would be undefined when the frontend POSTs a thesis object.

**`/health` endpoint** — a standard convention. Infrastructure tools (load balancers, monitoring systems, Docker health checks) hit this endpoint to verify the server is running. Returning `{ status: 'ok' }` is sufficient.

---

### Environment Variables and .env.example

Secrets — API keys, database passwords — must never be committed to git. Instead, we follow this pattern:

1. `.env` — the real secrets file. Listed in `.gitignore`. Never committed.
2. `.env.example` — a template showing what variables are needed, with fake values. This *is* committed.

When a new developer clones the repo, they run `cp .env.example .env` and fill in real values. The `.env.example` file documents exactly what configuration the app needs without exposing any real credentials.

Our `.env.example`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/trading_thesis_ai"
ANTHROPIC_API_KEY="sk-ant-..."
PORT=3001
NODE_ENV=development
```

- `DATABASE_URL` — the Postgres connection string. Format: `postgresql://[user]:[password]@[host]:[port]/[database]`.
- `ANTHROPIC_API_KEY` — the key for the Claude API. This is the most sensitive value in the app — it has billing implications.
- `PORT` — which port the Express server listens on. Configurable so it can run on different ports in different environments.
- `NODE_ENV` — `development` or `production`. Libraries like Express behave differently in each mode (more verbose errors in dev, optimised performance in prod).

---

### The Frontend (apps/frontend/)

The frontend is a **Next.js** application — a React framework that adds server-side rendering, file-based routing, and production build optimisation on top of React.

**Why Next.js over plain React?**
- File-based routing — create `app/theses/page.tsx` and it automatically becomes the `/theses` route. No router config needed.
- Server components — parts of the UI can be rendered on the server, which is faster for initial page load and better for SEO.
- Built-in API routes — you can add backend endpoints directly in the frontend app if needed (we won't use this — we have a dedicated backend).

**Tailwind CSS** is a utility-first CSS framework. Instead of writing custom CSS classes, you compose styles using small utility classes directly in your JSX:

```tsx
<div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
```

This reads as: full viewport height, near-black background, white text, flexbox centred content. The approach eliminates context-switching between `.tsx` and `.css` files and makes it impossible to accidentally break unrelated styles.

**PostCSS** is the tool that processes Tailwind's directives (`@tailwind base`, `@tailwind components`, `@tailwind utilities`) and outputs real CSS. It runs automatically as part of the Next.js build.

---

### What comes next?

This scaffolding gives us a runnable shell:
- `pnpm install` installs all dependencies
- `pnpm dev` starts both the backend (port 3001) and frontend (port 3000) in parallel
- `GET http://localhost:3001/health` returns `{ status: 'ok' }`
- `GET http://localhost:3000` shows the placeholder home page

The next PRs will add real functionality on top of this foundation:

| PR | What it adds |
|----|-------------|
| TTA-002 | PostgreSQL database schema via Prisma — the `theses` and `evaluations` tables |
| TTA-003 | Thesis CRUD API — create, list, update, delete theses |
| TTA-004 | LLM Evaluator — send a news headline + thesis to Claude, get back a structured impact assessment |
| TTA-005 | Frontend UI — thesis form, news input form, evaluation result display |

---

## TTA-002 — Database Schema (Prisma + PostgreSQL)

### What are we doing?

Every thesis a user writes, and every evaluation the AI produces, needs to be stored permanently. This PR introduces the database layer: the schema that defines our tables, and the Prisma ORM that lets TypeScript code talk to PostgreSQL in a type-safe way.

---

### Why PostgreSQL?

PostgreSQL is a production-grade relational database. We chose it over SQLite (simpler but file-based, not suited for concurrent access) and over NoSQL options (MongoDB, DynamoDB) because our data is inherently relational:

- A **thesis** belongs to a **user**
- An **evaluation** belongs to a **thesis**

These relationships are natural in a relational model. PostgreSQL also has strong support for enums, arrays (we use `String[]` for `keyRiskFactors`), and will handle the time-series evaluation history we need in later MVPs.

---

### What is an ORM?

ORM stands for Object-Relational Mapper. Without one, you would write raw SQL strings:

```typescript
const result = await client.query(
  'INSERT INTO theses (user_id, asset_name, direction, thesis_text) VALUES ($1, $2, $3, $4) RETURNING *',
  [userId, assetName, direction, thesisText]
);
```

With Prisma (our ORM), the same operation is:

```typescript
const thesis = await db.thesis.create({
  data: { userId, assetName, direction, thesisText }
});
```

The ORM gives you:
- **Type safety** — `db.thesis.create` knows exactly what fields are required. Pass the wrong field name and TypeScript errors at compile time, not at runtime when the query hits production.
- **Auto-generated types** — Prisma reads your schema and generates TypeScript types for every model. You never manually define a `Thesis` interface.
- **No SQL injection risk** — all values are parameterised automatically.
- **Migrations** — Prisma tracks schema changes and generates SQL migration files so your database schema stays in sync with your code.

---

### The Schema (prisma/schema.prisma)

The schema file is the single source of truth for the database structure. Prisma reads it to generate the TypeScript client and to create migration SQL.

**generator block** — tells Prisma to generate a TypeScript client (`prisma-client-js`). After running `prisma generate`, you import `{ PrismaClient }` from `@prisma/client` and get fully typed access to every table.

**datasource block** — tells Prisma which database to connect to. `env("DATABASE_URL")` reads the connection string from the `.env` file at runtime.

---

### The Models

#### User
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  theses    Thesis[]
}
```

- `@id` — marks this as the primary key.
- `@default(uuid())` — the database generates a UUID for every new row automatically. We use UUIDs instead of sequential integers because they are globally unique (safe when data is distributed or merged) and do not leak information about how many records exist.
- `@unique` on `email` — enforces uniqueness at the database level, not just in application code. Even if two requests arrive simultaneously, only one will succeed.
- `@map("created_at")` — the Prisma model field is `createdAt` (camelCase, TypeScript convention), but the actual database column is `created_at` (snake_case, SQL convention). `@map` bridges the two.
- `theses Thesis[]` — this is a **relation field**. It does not create a column in the database; it tells Prisma that a User has many Theses. You can then do `db.user.findUnique({ include: { theses: true } })` to fetch a user and all their theses in one query.
- `@@map("users")` — the Prisma model is named `User` (singular, PascalCase), but the database table is `users` (plural, lowercase). `@@map` bridges the two.

#### Thesis
```prisma
model Thesis {
  id         String       @id @default(uuid())
  userId     String       @map("user_id")
  assetName  String       @map("asset_name")
  direction  Direction
  thesisText String       @map("thesis_text")
  status     ThesisStatus @default(ACTIVE)
  createdAt  DateTime     @default(now()) @map("created_at")
  updatedAt  DateTime     @updatedAt @map("updated_at")
  ...
}
```

- `direction Direction` — uses the `Direction` enum (`LONG` or `SHORT`). Stored as a string in PostgreSQL via a native enum type. Type-safe in TypeScript — you cannot pass `"long"` by accident.
- `status ThesisStatus @default(ACTIVE)` — new theses start as `ACTIVE`. Users can pause or close them later. Having this as an enum (not a boolean `isActive`) means the state machine is extensible — adding `ARCHIVED` later is a one-line schema change.
- `@updatedAt` — Prisma automatically sets this field to the current timestamp every time the row is updated. You never need to remember to set it manually.

#### Evaluation
```prisma
model Evaluation {
  impactDirection ImpactDirection
  confidence      Int
  reasoning       String
  suggestedAction SuggestedAction
  keyRiskFactors  String[]
  ...
}
```

This model maps exactly to the structured JSON the LLM returns. Every field in the AI's response has a typed column in the database:
- `confidence Int` — 0 to 100.
- `reasoning String` — 2-3 sentence explanation from the LLM.
- `keyRiskFactors String[]` — PostgreSQL natively supports array columns. This stores the array of risk factor strings without needing a separate join table.
- `newsBody String?` — the `?` makes this nullable. The news body is optional — a headline alone is sometimes enough for evaluation.

---

### The Enums

```prisma
enum Direction      { LONG SHORT }
enum ThesisStatus   { ACTIVE PAUSED CLOSED }
enum ImpactDirection { SUPPORTS WEAKENS NEUTRAL }
enum SuggestedAction { HOLD REVIEW CONSIDER_CLOSING }
```

PostgreSQL creates native enum types for these. This means the database itself rejects invalid values — not just the application layer. If a bug causes the code to try inserting `"BULLISH"` into the `direction` column, PostgreSQL returns an error immediately.

---

### The Prisma Client Singleton (src/lib/db.ts)

```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
```

This pattern solves a specific problem with hot-reloading in development.

Every time you save a file in development, the dev server reloads the module. Without this pattern, each reload would create a new `PrismaClient` instance, opening a new database connection pool. After enough reloads, you exhaust PostgreSQL's connection limit.

The fix: store the client on `globalThis` — the one object that persists across module reloads. On each reload, we check if a client already exists on `globalThis` and reuse it if so (`??` means "if the left side is null or undefined, use the right side"). In production, module reloads never happen, so we skip the global assignment entirely.

---

### Running the Migration

With the schema defined, two commands set up the database:

```bash
# From apps/backend/
npx prisma migrate dev --name init
```

This command:
1. Reads `schema.prisma`
2. Generates SQL (`CREATE TABLE users ...`, `CREATE TABLE theses ...`, etc.)
3. Writes it to `prisma/migrations/[timestamp]_init/migration.sql`
4. Runs the SQL against the database
5. Runs `prisma generate` to update the TypeScript client

The migration file is committed to git. This gives every developer (and every CI/CD environment) a reproducible history of every schema change ever made.

```bash
# To apply migrations in production (no schema drift, no interactive prompts):
npx prisma migrate deploy
```

---

### What comes next?

The database schema is in place. TTA-003 will build the Thesis CRUD API on top of it — the Express routes that create, read, update, and delete theses using the Prisma client we set up here.

---

## TTA-003 — Thesis CRUD API

### What are we doing?

With the database schema in place, this PR builds the HTTP API that lets clients create, read, update, and delete trading theses. It also introduces two new structural concepts: the **service layer** and **request validation**.

---

### New Files

```
apps/backend/src/
├── routes/
│   └── theses.ts        ← HTTP layer: parse request, call service, return response
└── services/
    └── thesisService.ts ← Business logic layer: all database operations
```

This two-layer split is a deliberate architectural choice. Here is why it matters.

---

### Why Separate Routes from Services?

A route handler has one job: speak HTTP. It reads from `req`, calls something that does the real work, and writes to `res`.

A service has one job: own the business logic. It knows nothing about HTTP — no `req`, no `res`, no status codes.

Without this separation, a route handler looks like this:

```typescript
app.post('/theses', async (req, res) => {
  const { assetName, direction, thesisText, userId } = req.body;
  if (!assetName || !direction || !thesisText) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const thesis = await db.thesis.create({ data: { assetName, direction, thesisText, userId } });
  res.status(201).json(thesis);
});
```

This works, but the database query is now coupled to the HTTP handler. If you later want to create a thesis from a background job (e.g. auto-creating a stub thesis when a broker position is detected in MVP 4), you cannot reuse this logic — it is buried inside an Express handler.

With the separation, the service becomes reusable:

```typescript
// From a route handler:
const thesis = await thesisService.create(parsed.data);

// From a background job in MVP 4:
const thesis = await thesisService.create({ userId, assetName, direction, thesisText });
```

Same logic, called from anywhere.

---

### What is Zod?

Zod is a TypeScript-first validation library. It lets you define the exact shape you expect from an incoming request body, and it rejects anything that does not match.

Without validation, a client could POST:
```json
{ "assetName": "", "direction": "SIDEWAYS", "thesisText": 12345 }
```
And your code would try to insert garbage into the database.

With Zod:
```typescript
const createSchema = z.object({
  assetName: z.string().min(1),
  direction: z.nativeEnum(Direction),
  thesisText: z.string().min(10),
  userId: z.string().uuid(),
});

const parsed = createSchema.safeParse(req.body);
if (!parsed.success) {
  res.status(400).json({ error: parsed.error.flatten() });
  return;
}
```

`safeParse` never throws — it returns either `{ success: true, data: ... }` or `{ success: false, error: ... }`. The `data` object on success is fully typed — TypeScript knows every field and its exact type. You pass it straight to the service with confidence.

`z.nativeEnum(Direction)` — Zod reads the Prisma-generated `Direction` enum and rejects any value that is not `"LONG"` or `"SHORT"`. The valid values stay in sync with the database schema automatically — no duplication.

---

### The Routes (src/routes/theses.ts)

| Method | Path | What it does |
|--------|------|-------------|
| `POST` | `/theses` | Create a new thesis |
| `GET` | `/theses` | List all theses, newest first |
| `GET` | `/theses/:id` | Fetch a single thesis by ID |
| `PATCH` | `/theses/:id` | Update any combination of fields |
| `DELETE` | `/theses/:id` | Soft delete — sets status to `CLOSED` |

Every route follows the same pattern:
1. Validate the request body with Zod (`safeParse`)
2. Return `400` immediately if validation fails
3. Call the relevant service method
4. Return `404` if the record was not found
5. Return the result as JSON

The route file never touches `db` directly — all database access goes through the service.

---

### The Service (src/services/thesisService.ts)

**Soft delete:**
```typescript
const softDelete = (id: string) => {
  return db.thesis
    .update({ where: { id }, data: { status: ThesisStatus.CLOSED } })
    .catch(() => null);
};
```

Soft delete means we never remove the row — we set `status` to `CLOSED`. This is intentional. A deleted thesis still has evaluations attached to it. Hard-deleting the thesis row would either cascade-delete all evaluations (losing history) or leave orphaned evaluation rows (breaking referential integrity). Soft delete preserves everything and keeps the audit trail intact.

`.catch(() => null)` — Prisma throws when `update` finds no matching row. Rather than letting that propagate as an unhandled 500 error, we catch it and return `null`. The route layer checks for `null` and returns a clean `404`. This keeps error handling explicit and predictable at every layer.

---

### Mounting Routes in index.ts

```typescript
import { thesesRouter } from './routes/theses';
app.use('/theses', thesesRouter);
```

`app.use('/theses', thesesRouter)` mounts the entire router at the `/theses` prefix. Every route defined inside `thesesRouter` is relative to that prefix — `router.get('/:id')` becomes `GET /theses/:id`. This keeps `index.ts` clean as more route files are added in future PRs — you just add one more `app.use(...)` line.

---

### Testing the API

Once running (`pnpm dev`), you can test with curl or Postman:

```bash
# Create a thesis
curl -X POST http://localhost:3001/theses \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "a0000000-0000-0000-0000-000000000001",
    "assetName": "Crude Oil (WTI)",
    "direction": "LONG",
    "thesisText": "Long oil due to expected supply disruptions from ongoing Middle East tensions reducing OPEC output capacity."
  }'

# List all theses
curl http://localhost:3001/theses

# Update status
curl -X PATCH http://localhost:3001/theses/<id> \
  -H "Content-Type: application/json" \
  -d '{ "status": "PAUSED" }'

# Soft delete
curl -X DELETE http://localhost:3001/theses/<id>
```

---

### What comes next?

TTA-004 adds the `POST /evaluate` endpoint — the core of the product. It accepts a thesis ID and a news headline, sends both to the Claude API with a versioned structured prompt, and returns a typed impact assessment (`SUPPORTS` / `WEAKENS` / `NEUTRAL`) with a confidence score, reasoning, suggested action, and key risk factors.

---

## TTA-004 — LLM Evaluator

### What are we doing?

This is the core feature of the product. Given a thesis and a news headline, this endpoint sends both to the Claude API and returns a structured assessment of how that news impacts the trade. The response is persisted to the `evaluations` table and returned to the client.

---

### New Files

```
apps/backend/src/
├── prompts/
│   └── thesis-evaluator-v1.ts  ← versioned system prompt + tool definition
└── services/
    └── evaluationService.ts    ← calls Anthropic, writes evaluation to DB
routes/
    └── evaluate.ts             ← POST /evaluate, GET /evaluate/:thesisId
```

---

### Why Tool Use Instead of Plain Prompting?

The naive approach would be to ask the LLM to "return a JSON object" in plain text and then parse the response with `JSON.parse`. This is fragile — the model might add a preamble ("Sure, here is the evaluation:"), wrap in markdown code fences, or include trailing text. Any of these breaks the parse.

Anthropic's **tool use** feature solves this at the API level. You define a tool with a strict JSON schema, and set `tool_choice: { type: "any" }` to force the model to call it. The model cannot return prose — it must populate the tool's input fields. The SDK returns the result in a structured `tool_use` block, not a raw string.

The result: **100% parseable output, guaranteed by the API**.

```typescript
tool_choice: { type: 'any' }
```

`'any'` means "you must call one of the provided tools". Since we only provide one tool (`submit_evaluation`), the model is forced to call it. There is no escape hatch to free-text prose.

---

### The Prompt (src/prompts/thesis-evaluator-v1.ts)

The prompt is stored as a versioned file, not an inline string. This is a deliberate engineering practice:

- **Versioning** — `v1` in the filename means we can create `v2` later without touching anything that uses `v1`. This matters for A/B testing and prompt regression tracking.
- **Single source of truth** — every evaluation in production uses the same prompt. If a bug is found in the prompt, fixing the file fixes all future evaluations.
- **Reviewable in git** — prompt changes show up as code diffs in PRs, the same as any other logic change.

**System prompt** — sets the model's persona and constraints before any user content arrives:
```
You are a financial analysis assistant specialising in evaluating how news events impact
active trading positions. You are precise, concise, and non-speculative.
```
"Non-speculative" is a critical instruction. Without it, the model might infer implications beyond what the news actually states, producing confident-sounding assessments based on reasoning rather than evidence.

**User prompt builder** — `buildEvaluatorUserPrompt` takes the thesis fields and news content and formats them into the structured prompt the model receives. News body is capped at 2,000 characters — longer inputs push the context towards the token limit and increase cost without proportionally improving evaluation quality.

**Tool definition** — the `input_schema` defines exactly what the model must return:

```typescript
{
  impactDirection: 'SUPPORTS' | 'WEAKENS' | 'NEUTRAL',
  confidence: number,          // 0–100
  reasoning: string,           // 2–3 sentences
  suggestedAction: 'HOLD' | 'REVIEW' | 'CONSIDER_CLOSING',
  keyRiskFactors: string[]     // up to 3 items
}
```

Every field maps directly to a column in the `evaluations` table. There is no transformation layer between what the LLM returns and what gets stored.

---

### The Evaluation Service (src/services/evaluationService.ts)

The service is split into two clear responsibilities:

**`callLLM`** — a private function that handles the Anthropic API call. It constructs the request, fires it, and extracts the tool use block from the response. If the model somehow fails to call the tool, it throws — we do not silently store a null result.

**`evaluate`** — the public function. It:
1. Fetches the thesis from the database (returns `null` if not found — the route returns 404)
2. Calls `callLLM` with the thesis fields and news content
3. Persists the result to the `evaluations` table
4. Returns the created evaluation record

This means every evaluation is **logged permanently**. Even if the user never looks at it again, the data is there for future features — thesis health scores (MVP 3), price correlation (MVP 4), and prompt improvement analysis.

---

### The Anthropic Client

```typescript
const client = new Anthropic();
```

The SDK reads `ANTHROPIC_API_KEY` from `process.env` automatically. No config needed — as long as the key is in `.env`, it works.

```typescript
model: 'claude-sonnet-4-6',
max_tokens: 1024,
```

`claude-sonnet-4-6` — the current production Sonnet model. Fast enough for sub-4-second responses, capable enough for financial reasoning.

`max_tokens: 1024` — caps the response length. Tool use responses are structured and compact — 1,024 tokens is more than enough and prevents runaway costs if the model tries to over-explain.

---

### The Routes (src/routes/evaluate.ts)

| Method | Path | What it does |
|--------|------|-------------|
| `POST` | `/evaluate` | Run an evaluation against a thesis |
| `GET` | `/evaluate/:thesisId` | List all evaluations for a thesis |

The `POST` route accepts:
```json
{
  "thesisId": "<uuid>",
  "newsHeadline": "OPEC agrees to extend production cuts through Q3",
  "newsBody": "Optional full article text..."
}
```

And returns the full stored evaluation, including the LLM's `impactDirection`, `confidence`, `reasoning`, `suggestedAction`, and `keyRiskFactors`.

---

### Testing the Evaluator

```bash
# First create a thesis, then run an evaluation against it:
curl -X POST http://localhost:3001/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "thesisId": "<your-thesis-id>",
    "newsHeadline": "OPEC agrees to extend production cuts through Q3",
    "newsBody": "OPEC and its allies agreed on Sunday to extend production cuts of 3.66 million barrels per day through the end of Q3, supporting oil prices amid demand uncertainty."
  }'

# Expected response:
{
  "impactDirection": "SUPPORTS",
  "confidence": 82,
  "reasoning": "The OPEC production cut extension directly reduces supply, which supports the long oil thesis based on supply restriction. This is a fundamental catalyst aligned with the original thesis reasoning.",
  "suggestedAction": "HOLD",
  "keyRiskFactors": ["Demand-side weakness could offset supply cuts", "Compliance risk among OPEC members", "USD strength may cap oil price upside"]
}
```

---

### What comes next?

TTA-005 builds the frontend — a Next.js UI with three views: a form to create theses, a manual news input form to trigger evaluations, and a colour-coded result display (green = SUPPORTS, red = WEAKENS, grey = NEUTRAL).

---

## TTA-005 — Frontend UI

### What are we doing?

This PR builds the web interface for MVP 1. Three screens: a thesis list with a create form, a thesis detail page with a news evaluation form, and colour-coded evaluation results. No auth yet — a fixed demo user ID is used throughout.

---

### New Files

```
apps/frontend/src/
├── lib/
│   └── api.ts                     ← typed API client (fetch wrapper)
├── components/
│   └── EvaluationResult.tsx       ← colour-coded result card
└── app/
    ├── page.tsx                   ← home: thesis list + create form
    └── theses/[id]/
        └── page.tsx               ← thesis detail: evaluate form + history
```

---

### Next.js App Router

Next.js 14 uses the **App Router** — a file-based routing system where the folder structure under `src/app/` defines the URL structure:

| File | URL |
|------|-----|
| `src/app/page.tsx` | `/` |
| `src/app/theses/[id]/page.tsx` | `/theses/abc-123` |

`[id]` is a **dynamic segment** — Next.js captures whatever is in that URL position and makes it available via `useParams()`. This is how the thesis detail page knows which thesis to load.

---

### 'use client' Directive

Next.js 14 defaults all components to **Server Components** — they render on the server and send HTML to the browser. Server components cannot use `useState`, `useEffect`, or browser APIs.

Our pages need interactivity (forms, button clicks, live updates), so they are marked `'use client'` at the top of the file. This tells Next.js to render them in the browser as standard React components.

The rule of thumb: mark a component `'use client'` only when it needs interactivity. Static UI (headers, layout, purely visual elements) should stay as server components where possible for better performance.

---

### The API Client (src/lib/api.ts)

Rather than scattering `fetch` calls across components, all API communication is centralised in a single typed client.

```typescript
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
```

The generic `<T>` parameter lets callers declare what type they expect back:

```typescript
const theses = await request<Thesis[]>('/theses');
// TypeScript knows `theses` is a Thesis array — full autocomplete, no casting
```

`BASE_URL` reads from `NEXT_PUBLIC_API_URL` in the environment. In Next.js, only environment variables prefixed with `NEXT_PUBLIC_` are exposed to the browser bundle. Any variable without that prefix stays server-side only.

**`DEMO_USER_ID`** — since MVP 1 has no auth, every thesis is created under a fixed UUID. This is a known placeholder that will be replaced by the real authenticated user ID when auth is added in MVP 3.

---

### The EvaluationResult Component (src/components/EvaluationResult.tsx)

The colour coding maps directly to impact direction:

```typescript
const impactStyles = {
  SUPPORTS: 'border-green-500 bg-green-500/10 text-green-400',
  WEAKENS:  'border-red-500  bg-red-500/10  text-red-400',
  NEUTRAL:  'border-gray-500 bg-gray-500/10 text-gray-400',
};
```

`bg-green-500/10` — Tailwind's opacity modifier syntax. `green-500` is the base colour, `/10` means 10% opacity. This gives a subtle tinted background without being visually overwhelming.

The component is purely presentational — it receives an `Evaluation` object and renders it. No state, no API calls. This makes it trivially reusable: the same card appears both as the "latest result" immediately after an evaluation runs and in the historical list below.

---

### Home Page (src/app/page.tsx)

The home page manages two pieces of state:

- `theses` — the list fetched from the API on mount and after any mutation
- `showForm` / `form` — controls the create thesis form

**Optimistic UI pattern** — after deleting a thesis, it is removed from local state immediately (`setTheses(prev => prev.filter(...))`) without waiting for a refetch. The UI feels instant. For creates, we do refetch to get the server-assigned ID and timestamps.

**`line-clamp-2`** — a Tailwind utility that truncates text to 2 lines with an ellipsis. Keeps the list clean regardless of thesis text length.

---

### Thesis Detail Page (src/app/theses/[id]/page.tsx)

`Promise.all` loads the thesis and its evaluation history in parallel — one round trip instead of two:

```typescript
const [t, evals] = await Promise.all([
  api.theses.get(id),
  api.evaluations.listByThesis(id),
]);
```

After an evaluation is submitted, two things happen:
1. `latestEvaluation` is set so the result appears immediately below the form with a "Latest result" label
2. The full `evaluations` array is prepended with the new result so the history list updates instantly

The `newsBody` field is sent as `undefined` (not an empty string) when left blank. The backend accepts `null` / missing for that field — sending an empty string would pass Zod's `z.string()` check but is semantically wrong.

---

### What is MVP 1 complete?

With TTA-005 merged, the full MVP 1 loop is working end-to-end:

1. Open the app at `localhost:3000`
2. Create a thesis (asset, direction, thesis text)
3. Click **Evaluate** on a thesis
4. Paste a news headline and optional body
5. Click **Run Evaluation** — the backend calls Claude, gets a structured assessment, stores it
6. The result appears colour-coded: green (SUPPORTS), red (WEAKENS), grey (NEUTRAL)
7. All past evaluations are shown in the history list below

**Next: MVP 2** — connect to real financial news APIs (Polygon.io, Finnhub), build a Redis-backed ingestion pipeline, and automate the evaluation loop so it runs continuously without manual input.

---

## TTA-006 — Redis + BullMQ Queue Infrastructure

### What are we doing?

MVP 1 required manual news input — a user had to paste a headline to trigger an evaluation. MVP 2 makes the system fully automated: news articles come in continuously from external APIs, and the system evaluates them against all active theses without any human input.

This PR lays the infrastructure that makes that possible: a Redis connection and a BullMQ job queue. No news ingestion yet — that comes in TTA-007 and TTA-008. This PR just builds the pipes.

---

### Why a Queue?

Without a queue, the automated flow would look like this:

1. News article arrives
2. Fetch all active theses (say 50 users × 5 theses = 250 theses)
3. Call the LLM 250 times simultaneously

This causes two problems:
- **Rate limiting** — the Anthropic API has request limits. 250 simultaneous calls would hit them instantly and start failing.
- **Thundering herd** — a single news event causes a massive spike in compute. The system becomes unpredictable under load.

With a queue, the flow becomes:
1. News article arrives
2. Check relevance — only push jobs for theses where the article's entities match the thesis asset
3. Jobs sit in the queue
4. Worker processes them at a controlled rate (concurrency: 3 at a time)

The queue acts as a buffer and a rate limiter in one.

---

### New Files

```
apps/backend/src/
├── lib/
│   ├── redis.ts        ← IORedis client singleton
│   └── queue.ts        ← BullMQ queue definition + job type
└── workers/
    └── evaluationWorker.ts ← processes evaluation jobs from the queue
```

---

### IORedis (src/lib/redis.ts)

IORedis is the Node.js Redis client. BullMQ uses it internally to communicate with Redis.

```typescript
export const redis = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
```

`maxRetriesPerRequest: null` — BullMQ requires this setting. Without it, IORedis gives up after a fixed number of retries if Redis is temporarily unreachable. Setting it to `null` tells IORedis to keep retrying indefinitely, which is what you want for a long-running worker process.

We use Upstash Redis (cloud-hosted) with a `rediss://` URL — the double `s` means TLS-encrypted connection over HTTPS port 6379. This bypasses the port 5432 firewall issues that affected Supabase.

---

### The Queue (src/lib/queue.ts)

```typescript
export const evaluationQueue = new Queue<EvaluationJobData>('evaluation', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});
```

**`EvaluationJobData`** — the typed payload for every job:
```typescript
interface EvaluationJobData {
  thesisId: string;
  newsHeadline: string;
  newsBody?: string;
  source: string;
}
```

Every job carries exactly what the evaluation service needs — no extra lookups required inside the worker.

**`attempts: 3`** — if a job fails (e.g. Anthropic API timeout), BullMQ automatically retries it up to 3 times before marking it as failed.

**`backoff: exponential`** — retries wait 2s, then 4s, then 8s before each attempt. This prevents hammering the API when it is temporarily struggling.

**`removeOnComplete: 100`** — keep only the last 100 completed jobs in Redis. Completed jobs are not needed long-term — the result is already in PostgreSQL. Keeping them all would bloat Redis memory over time.

**`removeOnFail: 200`** — keep the last 200 failed jobs for debugging. More than completed jobs because failures are worth investigating.

---

### The Worker (src/workers/evaluationWorker.ts)

```typescript
export const evaluationWorker = new Worker<EvaluationJobData>(
  'evaluation',
  async (job) => {
    const result = await evaluationService.evaluate({ ... });
    return result;
  },
  { connection: redis, concurrency: 3 },
);
```

The worker listens on the `'evaluation'` queue and processes jobs as they arrive. The processor function is identical to what the manual `POST /evaluate` route does — it calls `evaluationService.evaluate()`. The queue is just a new way to trigger the same logic.

**`concurrency: 3`** — process up to 3 jobs simultaneously. This is a deliberate choice: fast enough to keep up with news volume, slow enough to stay within Anthropic API rate limits. This number can be tuned in future.

**`worker.on('failed')`** — logs failures with the job ID and error message. When MVP 3 adds monitoring, these events will feed into Sentry or a metrics dashboard.

The worker is started by importing the file in `index.ts`:
```typescript
import './workers/evaluationWorker';
```

Node.js executes the file on import, which instantiates the `Worker` object and begins listening on the queue immediately when the server starts.

---

### /health/pipeline Endpoint

```typescript
app.get('/health/pipeline', async (_req, res) => {
  const [waiting, active, failed] = await Promise.all([
    evaluationQueue.getWaitingCount(),
    evaluationQueue.getActiveCount(),
    evaluationQueue.getFailedCount(),
  ]);
  res.json({ waiting, active, failed, timestamp: new Date().toISOString() });
});
```

This endpoint gives a real-time snapshot of the queue state. Useful for debugging and will feed the pipeline health dashboard in MVP 3. `Promise.all` fetches all three counts in parallel — one round trip to Redis instead of three.

---

### What comes next?

The queue infrastructure is in place. TTA-007 connects to the Polygon.io News API, polls it every 60 seconds, and pushes relevant jobs onto the evaluation queue automatically.

---

## TTA-007 — Polygon.io News Poller + Signal Processor

### What are we doing?

This PR connects the system to a real financial news source for the first time. Every 60 seconds, the Polygon.io News API is polled for recent articles. Each article is normalised into a standard shape, deduplicated, matched against active theses, and — if relevant — pushed onto the BullMQ evaluation queue. The worker from TTA-006 then picks up the job and calls the LLM automatically.

---

### New Files

```
apps/backend/src/ingestion/
├── types.ts           ← NormalisedSignal — the standard shape all sources output
├── polygonPoller.ts   ← polls Polygon.io every 60s, normalises articles
└── signalProcessor.ts ← deduplication, relevance matching, queue dispatch
```

---

### Why a Normalisation Layer?

MVP 2 ingests from multiple sources: Polygon.io, Finnhub, RSS feeds. Each returns data in a completely different shape:

- Polygon returns `{ title, description, published_utc, tickers[] }`
- Finnhub returns `{ headline, summary, datetime, related }`
- RSS returns `{ title, content, pubDate, categories[] }`

Without normalisation, every piece of downstream code (deduplication, relevance matching, queue dispatch) would need to know about each source's shape. Adding a new source would mean updating all of them.

The `NormalisedSignal` interface defines a single shape that all sources map to:

```typescript
interface NormalisedSignal {
  headline: string;
  body: string;
  publishedAt: string;
  source: string;
  tickers: string[];
  url: string;
}
```

Each ingestion source is responsible for mapping its own response to this shape. Everything downstream speaks only `NormalisedSignal` — it doesn't know or care where the article came from.

---

### The Polygon Poller (src/ingestion/polygonPoller.ts)

```typescript
export const startPolygonPoller = () => {
  poll();
  setInterval(poll, POLL_INTERVAL_MS);
};
```

`setInterval` runs `poll()` every 60 seconds indefinitely. The first call is immediate — no waiting for the first interval to elapse before data starts flowing.

**Incremental fetching with `lastPublishedAt`** — on the first poll, all recent articles are fetched. On every subsequent poll, we send `published_utc.gt=<lastPublishedAt>` to Polygon, which returns only articles published after the last one we saw. This prevents re-processing the same articles on every poll.

```typescript
if (lastPublishedAt) {
  params['published_utc.gt'] = lastPublishedAt;
}
```

After a successful fetch, `lastPublishedAt` is updated to the most recent article's timestamp. On server restart, this resets to `null` and we fetch recent articles again — a small amount of reprocessing, harmless because of deduplication.

**Graceful error handling** — if the Polygon API is down or returns an error, the `catch` block logs the error and returns. The `setInterval` keeps running — the next poll will try again. The server does not crash.

---

### The Signal Processor (src/ingestion/signalProcessor.ts)

The processor does three things in sequence for every incoming signal.

**1. Deduplication**

```typescript
const hash = createHash('sha256')
  .update(`${signal.source}:${signal.headline}`)
  .digest('hex');

const key = `dedup:${hash}`;
const existing = await redis.get(key);
if (existing) return true;
await redis.setex(key, DEDUP_TTL_SECONDS, '1');
```

A SHA-256 hash of `source + headline` is computed and stored in Redis with a 1-hour TTL (`setex` = set + expire). If the same key already exists, the article has already been processed — return early.

Why SHA-256? It produces a fixed-length 64-character hex string regardless of input length. Storing the full headline as a Redis key would be wasteful and inconsistent. The hash is deterministic — the same headline always produces the same hash.

Why 1 hour TTL? Long enough to catch duplicates from multiple sources covering the same story. Short enough that the Redis memory footprint stays small.

**2. Relevance Matching**

```typescript
const theses = await db.thesis.findMany({ where: { status: 'ACTIVE' } });

return theses.filter((thesis) => {
  const tickerMatch = signal.tickers.some(t => assetLower.includes(t.toLowerCase()));
  const textMatch = headlineLower.includes(assetLower) || bodyLower.includes(assetLower);
  return tickerMatch || textMatch;
});
```

Only `ACTIVE` theses are fetched — no point evaluating news against paused or closed positions.

Two matching strategies:
- **Ticker match** — Polygon tags articles with stock tickers (e.g. `["AAPL", "MSFT"]`). If any ticker appears in the thesis asset name (or vice versa), it's a match.
- **Text match** — if the thesis asset name appears anywhere in the headline or body, it's a match. This catches commodities and macro assets that don't have tickers (`"Crude Oil"`, `"Gold"`, `"US Dollar"`).

This relevance filter is the most important cost-saving mechanism in the system. Without it, every news article would trigger LLM calls for every thesis. With it, only genuinely relevant articles make it to the queue.

**3. Queue Dispatch**

```typescript
await evaluationQueue.add(
  `eval:${thesis.id}:${signal.publishedAt}`,
  { thesisId: thesis.id, newsHeadline: signal.headline, newsBody: signal.body, source: signal.source },
);
```

One job is pushed per `(thesis, signal)` pair. The job name `eval:[thesisId]:[publishedAt]` is human-readable in the BullMQ dashboard and unique enough to identify each job.

The evaluation worker from TTA-006 picks these jobs up automatically — no changes needed there.

---

### The Full Automated Flow

With TTA-007 merged, the system runs without any manual input:

1. Server starts → `startPolygonPoller()` begins polling every 60 seconds
2. Article arrives → `processSignal()` deduplicates and matches against active theses
3. Relevant matches → jobs pushed to `evaluation` queue
4. Worker picks up job → calls `evaluationService.evaluate()` → LLM returns structured assessment
5. Evaluation stored in PostgreSQL → visible in thesis history on the frontend

---

### What comes next?

TTA-008 adds Finnhub WebSocket (real-time, sub-second news delivery) and RSS feed ingestion (FT, Reuters, Bloomberg for macro news). Both feed into the same `processSignal` function — the normalisation layer means zero changes needed to the processor or worker.

---

## TTA-008 — Finnhub WebSocket + RSS Ingestion

### What are we doing?

TTA-007 gave us one news source (Polygon.io) polling every 60 seconds. This PR adds two more: Finnhub via a persistent WebSocket connection for real-time sub-second delivery, and RSS feeds from Reuters, the Financial Times, and Investing.com for broad macro coverage. All three sources feed into the same `processSignal` function — the normalisation layer from TTA-007 means zero changes to the processor or worker.

---

### New Files

```
apps/backend/src/ingestion/
├── finnhubSocket.ts   ← persistent WebSocket, auto-reconnect
└── rssPoller.ts       ← polls 3 RSS feeds every 5 minutes
```

---

### Finnhub WebSocket (src/ingestion/finnhubSocket.ts)

Finnhub offers a WebSocket API that pushes news in real time — as soon as an article is published, it arrives at our connection. This is fundamentally different from polling:

| | Polling (Polygon) | WebSocket (Finnhub) |
|--|---|---|
| Latency | Up to 60 seconds | Sub-second |
| Connection | New HTTP request every minute | Single persistent TCP connection |
| Server load | Regular API calls | One connection, event-driven |

For a trading system where minutes matter, WebSocket delivery is worth the added complexity.

**Connection lifecycle:**

```typescript
ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'subscribe', symbol: 'GENERAL:^NEWS' }));
});
```

On connection, we subscribe to `GENERAL:^NEWS` — Finnhub's general news stream. Finnhub then pushes all news events to this connection as they are published.

**Auto-reconnect:**

```typescript
ws.on('close', () => {
  setTimeout(connect, RECONNECT_DELAY_MS);
});
```

WebSocket connections drop — network hiccups, server restarts, idle timeouts. The `close` handler schedules a reconnection attempt after 5 seconds. This makes the ingestion self-healing: if the connection drops at 3am, it reconnects automatically without any human intervention.

**Message handling:**

```typescript
const msg: FinnhubNewsItem = JSON.parse(raw.toString());
if (msg.type !== 'news' || !msg.data?.length) return;
```

Finnhub sends different message types over the same connection (news, ping, error). We filter for `type === 'news'` and ignore everything else. Each news message can contain multiple articles in `data[]` — we process each one through `processSignal`.

---

### RSS Ingestion (src/ingestion/rssPoller.ts)

RSS (Really Simple Syndication) is a standardised XML feed format that almost every major publisher supports. It is free, requires no API key, and covers macro and geopolitical news that financial APIs often miss.

**Why RSS for macro news?**

Polygon and Finnhub focus on equity markets — tickers, earnings, corporate actions. Our system also needs to catch macro events: central bank decisions, geopolitical developments, commodity supply news. Reuters and the FT publish these through RSS feeds that are publicly accessible.

**Feed list:**

```typescript
const FEEDS = [
  { url: 'https://feeds.reuters.com/reuters/businessNews', source: 'Reuters' },
  { url: 'https://feeds.ft.com/rss/home/uk',              source: 'Financial Times' },
  { url: 'https://www.investing.com/rss/news.rss',        source: 'Investing.com' },
];
```

**`rss-parser`** handles the XML parsing. It fetches the URL, parses the XML, and returns a clean JavaScript object with `items[]`. We map each item to a `NormalisedSignal`.

RSS articles have no `tickers[]` — relevance matching falls back entirely to text matching (headline + body containing the thesis asset name). This is why `NormalisedSignal.tickers` is typed as `string[]` with an empty array as the RSS default.

**5-minute poll interval:**

```typescript
const POLL_INTERVAL_MS = 300_000;
```

RSS feeds are not real-time — publishers typically update them every few minutes. Polling every 5 minutes is sufficient and avoids hammering the feed servers. The deduplication layer in `signalProcessor` ensures articles seen on one poll are not reprocessed on the next.

**Per-feed error isolation:**

```typescript
for (const feed of FEEDS) {
  try {
    await pollFeed(feed.url, feed.source);
  } catch (err) {
    console.error(`[rss] error polling ${feed.source}:`, message);
  }
}
```

Each feed is polled inside its own try/catch. If the Reuters feed is down, the FT and Investing.com feeds still run. One failed source does not block the others.

---

### Three Sources, One Pipeline

With TTA-008 merged, three independent ingestion paths all converge on `processSignal`:

```
Polygon.io (60s poll)  ──┐
Finnhub WebSocket      ──┼──▶ processSignal ──▶ dedup ──▶ relevance match ──▶ queue ──▶ worker ──▶ LLM
RSS feeds (5m poll)    ──┘
```

The same deduplication hash prevents the same story from being processed twice, even if Polygon and Reuters both publish it. The normalisation layer means adding a fourth source in future is a single new file — no changes anywhere else.

---

### What comes next?

TTA-009 adds the `/signals` and `/evaluations` API endpoints so the frontend can display the live signal feed and filterable evaluation history. TTA-010 follows with the alert dispatcher — email notifications when a high-confidence evaluation arrives.

---

## TTA-009 — Signals & Evaluations API Endpoints

### What are we doing?

The pipeline is now running — signals flow in, get matched, and evaluations are stored. But the frontend has no way to display any of this yet. This PR adds the `GET /signals` and `GET /evaluations` endpoints, persists signals to a new `signals` table, and adds a per-thesis `alertThreshold` field so users can configure their own confidence cutoff.

---

### Schema Changes

**New `signals` table** — every article that passes deduplication is now persisted to the database, regardless of whether it matched any thesis. This gives us a complete feed of all processed news, not just the ones that triggered evaluations.

```prisma
model Signal {
  id          String   @id @default(uuid())
  headline    String
  body        String?
  source      String
  tickers     String[]
  url         String
  publishedAt DateTime @map("published_at")
  createdAt   DateTime @default(now()) @map("created_at")
}
```

**`alertThreshold` on `Thesis`** — a per-thesis integer (0–100) defaulting to 70. The alert dispatcher (TTA-010) will only send an alert when an evaluation's confidence meets or exceeds this threshold. Different traders have different risk tolerances — a thesis on a volatile asset might warrant a lower threshold.

```prisma
alertThreshold Int @default(70) @map("alert_threshold")
```

Both changes are applied via a Prisma migration (`add_signals_and_alert_threshold`), which generates the SQL and runs it against the database automatically.

---

### New Files

```
apps/backend/src/
├── services/
│   ├── signalService.ts      ← fetches recent signals from DB
│   └── evaluationsService.ts ← filterable evaluation list with thesis join
└── routes/
    ├── signals.ts            ← GET /signals
    └── evaluations.ts        ← GET /evaluations (filterable)
```

---

### GET /signals

Returns the 50 most recent processed signals, newest first:

```bash
GET /signals
```

```json
[
  {
    "id": "...",
    "headline": "OPEC extends production cuts through Q3",
    "source": "Reuters",
    "tickers": [],
    "publishedAt": "2026-03-17T14:00:00.000Z"
  }
]
```

---

### GET /evaluations (with filters)

The evaluations endpoint supports query parameters for filtering:

```bash
GET /evaluations?thesisId=<uuid>&impactDirection=WEAKENS&from=2026-03-01&limit=20
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `thesisId` | UUID | Filter by thesis |
| `impactDirection` | `SUPPORTS` \| `WEAKENS` \| `NEUTRAL` | Filter by impact |
| `from` | ISO date | Evaluations after this date |
| `to` | ISO date | Evaluations before this date |
| `limit` | number | Max results (default 100) |

The response includes a `thesis` join — each evaluation carries `{ assetName, direction }` so the frontend can display context without a separate request:

```typescript
include: { thesis: { select: { assetName: true, direction: true } } }
```

This is a Prisma **relation include** — a single query with a JOIN, not two separate queries. Prisma generates the SQL automatically from the schema relation.

---

### Why Persist Signals?

You might ask: why store signals at all? The evaluations table already has the headline.

Two reasons:

1. **Audit trail** — we store every processed article, not just the ones that matched a thesis. If a user adds a new thesis later, we can see what relevant news existed before it was created.

2. **Signal feed UI** — the frontend signal feed (TTA-013) shows all recent news the system has seen, not just the ones that triggered evaluations. This gives traders a live view of what the system is monitoring, building trust in the product.

---

### What comes next?

TTA-010 builds the alert dispatcher — when a high-confidence evaluation is stored, it sends an email to the user with the impact summary.

---

## TTA-010 — Alert Dispatcher (Resend Email)

### What problem are we solving?

The pipeline can now ingest news, process signals, and run LLM evaluations automatically. But that value is lost unless the trader actually *sees* the result. TTA-010 closes the loop: when an automated evaluation's confidence meets or exceeds the thesis's `alertThreshold`, an email is dispatched to the trader.

---

### Why email as the first alert channel?

Email is the lowest-friction channel to implement and the highest-reach channel for most users — it requires no app install, no account linking, and no webhook setup on the user's side. Using **Resend** (a transactional email API) we get reliable delivery, structured HTML emails, and a free tier that covers the entire dev and MVP phase.

In later MVPs we can add Slack webhooks, SMS, or push notifications. The architecture is designed so `alertService.ts` is a single point of extension — you add a new channel by adding a send call inside `sendAlert()`.

---

### How the threshold works

`alertThreshold` is an integer field (0–100) on the `Thesis` model, defaulting to 70. When the `evaluationWorker` processes a job:

1. It calls `evaluationService.evaluate()`.
2. That function fetches the thesis (including its user record via Prisma relation join).
3. After persisting the evaluation, it checks `if (result.confidence >= thesis.alertThreshold)`.
4. If the condition is met, it calls `alertService.sendAlert()`.

This keeps the threshold check co-located with the evaluation write — there is no separate polling job or cron that scans for pending alerts.

---

### alertService.ts

```typescript
// Sends one email per high-confidence evaluation
const sendAlert = async (params: AlertParams) => {
  if (!process.env.RESEND_API_KEY) return; // graceful no-op in dev without a key

  await resend.emails.send({
    from: 'Trading Thesis AI <onboarding@resend.dev>',
    to: params.userEmail,
    subject: `⚠️ Thesis Alert: ${params.assetName} — ${params.impactDirection}`,
    html: buildEmailHtml(params),
  });
};
```

The `from` address uses Resend's shared sandbox domain (`onboarding@resend.dev`) during development. For production, you verify your own domain in the Resend dashboard and update the `FROM` constant.

---

### Why guard with `if (!process.env.RESEND_API_KEY) return`?

This pattern lets the application run fully in local development without an email key configured. The evaluation still runs and persists — only the email is skipped. This avoids breaking the entire pipeline just because email credentials are missing.

---

### What comes next?

TTA-013 completes MVP 2 by updating the frontend: a live signal feed showing the ingested news, a filterable evaluation history across all theses, and an alert threshold slider on the thesis detail page so traders can tune their sensitivity without touching the database.


---

## TTA-013 — Frontend: Signal Feed, Evaluation History, Alert Threshold UI

### What are we building?

MVP 2 has a fully working backend pipeline — news in, evaluations out, emails sent. But the frontend is still MVP 1: you can only see theses and manually run evaluations. TTA-013 brings the pipeline into the UI with three additions:

1. **Signal feed** — a live list of processed news signals
2. **Evaluation history** — a filterable view across all theses
3. **Alert threshold** — a slider on each thesis to control email sensitivity

---

### Navigation

We added a persistent nav bar to `layout.tsx` (the Next.js root layout) with three links: **Theses**, **Signals**, **Evaluations**. Because `layout.tsx` is a server component, we can render static `<Link>` elements there without wrapping in `'use client'` — React only hydrates interactive parts (the children).

This is the correct place for global chrome. Putting the nav in `page.tsx` would mean it disappears on inner pages.

---

### Signal Feed (`/signals`)

The signals page fetches `GET /signals` on mount and auto-refreshes every 30 seconds using `setInterval` inside `useEffect`. The cleanup function (`return () => clearInterval(interval)`) ensures the interval is torn down when the user navigates away, preventing memory leaks.

```typescript
useEffect(() => {
  load();
  const interval = setInterval(load, 30000);
  return () => clearInterval(interval);
}, [load]);
```

Each signal card shows the source badge (Polygon / Finnhub / RSS), an optional ticker badge, the headline, a link to the source URL, and a relative time ("5m ago"). The relative time function avoids any date library dependency — it's four lines of arithmetic.

---

### Evaluation History (`/evaluations`)

The evaluations page uses the new `GET /evaluations` endpoint which returns evaluations with their parent thesis embedded:

```json
{
  "id": "...",
  "newsHeadline": "...",
  "impactDirection": "WEAKENS",
  "confidence": 85,
  "thesis": { "assetName": "Crude Oil WTI", "direction": "LONG" }
}
```

Filters (impact direction, date range) are controlled by a form. Clicking **Apply** re-fetches with the selected query parameters. Clicking **Clear** resets state and re-fetches all.

The `URLSearchParams` approach in `api.ts` ensures only non-empty filters are appended to the query string — sending `impactDirection=` (empty string) to the backend would break the Prisma enum cast.

---

### Alert Threshold Slider

The threshold section is added between the thesis info card and the evaluate form in `theses/[id]/page.tsx`. It loads the current `alertThreshold` value from the thesis object and stores it in local state. When the user drags the slider, local state updates immediately (optimistic UI). Clicking **Save** calls `PATCH /theses/:id` with `{ alertThreshold: N }`.

```typescript
const handleSaveThreshold = async () => {
  const updated = await api.theses.update(id, { alertThreshold: threshold }).catch(() => null);
  if (updated) setThesis(updated); // sync server truth back into state
};
```

The Save button is disabled when the local value matches the server value (no change to persist) or while the request is in flight. A brief "Saved ✓" confirmation replaces the label for 2 seconds after success — no toast library needed.

---

### Backend change: exposing alertThreshold in PATCH

The existing `updateSchema` in `routes/theses.ts` did not include `alertThreshold`. We added it as an optional integer validated 0–100:

```typescript
alertThreshold: z.number().int().min(0).max(100).optional(),
```

The corresponding `UpdateThesisInput` interface in `thesisService.ts` was extended to match. Because Prisma's `update()` accepts a `data` object typed against the schema, no further changes were needed — Prisma handles the DB write.

---

### What comes next?

MVP 2 is complete. MVP 3 introduces:
- **Thesis health scores** — a rolling signal of how well the thesis is holding up over time
- **Multi-channel alerts** — Slack webhooks and SMS alongside email
- **Auth** — Clerk replaces the hardcoded demo user ID

---

## TTA-014 — Clerk Auth

### The problem with DEMO_USER_ID

Every API request up to this point used a hardcoded UUID:

```typescript
export const DEMO_USER_ID = 'a0000000-0000-0000-0000-000000000001';
```

This meant all users shared the same data, no route was protected, and there was no concept of identity. MVP 3 starts here — real auth.

---

### Why Clerk?

Clerk is a hosted authentication platform. Instead of building login forms, session management, token refresh, and password hashing yourself, you integrate a few components and the entire auth lifecycle is handled for you.

The alternative (rolling your own with JWTs + bcrypt + sessions) is weeks of work, well-understood attack surface, and not the value this product is trying to create. For an MVP, Clerk is the right call.

---

### Key architectural decision: drop the User model entirely

The original schema had a `User` model with a UUID primary key and a foreign key on `Thesis`:

```prisma
model User {
  id     String @id @default(uuid())
  email  String @unique
  theses Thesis[]
}

model Thesis {
  userId String @map("user_id")
  user   User   @relation(fields: [userId], references: [id])
}
```

Clerk user IDs look like `user_2Nxxx` — they are not UUIDs. Keeping the FK would require syncing every Clerk user creation/deletion event via webhooks to keep the `users` table in sync with Clerk's state. That's operational overhead for no gain.

The decision: drop the `User` model and the FK entirely. `userId` on `Thesis` stays as a plain `String` with no relation:

```prisma
model Thesis {
  userId String @map("user_id")  -- plain string, no FK
}
```

The migration is two lines:

```sql
ALTER TABLE "theses" DROP CONSTRAINT "theses_user_id_fkey";
DROP TABLE "users";
```

Clerk is now the source of truth for user identity. The database never needs to know about the `User` table — it just stores the Clerk ID as an opaque string.

---

### Backend: Clerk middleware

`@clerk/express` provides two things we use:

**`clerkMiddleware()`** — registers Clerk's authentication state on every request. This doesn't reject anything — it just makes `getAuth(req)` available downstream. Applied globally after `express.json()`.

**`getAuth(req)`** — extracts the authenticated user's ID from the request. Returns `{ userId: string | null }`. If no valid session token was sent, `userId` is null.

**`requireAuth`** — our thin guard that checks `userId` and returns 401 if absent:

```typescript
export function requireAuth(req, res, next) {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  next();
}
```

Applied as `router.use(requireAuth)` at the top of every route file. Health endpoints (`/health`, `/health/pipeline`) are intentionally left unprotected — they need to be reachable by uptime monitors without credentials.

---

### Ownership checks on PATCH and DELETE

Previously there was no concept of "this thesis belongs to this user". Any authenticated user could mutate any thesis by ID. With real auth, we add an ownership check before mutating:

```typescript
const thesis = await thesisService.getById(req.params.id);
if (!thesis) { res.status(404).json({ error: 'Thesis not found' }); return; }
if (thesis.userId !== userId) { res.status(403).json({ error: 'Forbidden' }); return; }
```

404 before 403 — we don't reveal that a resource exists to someone who doesn't own it.

---

### User-scoped data

`GET /theses` previously returned all non-closed theses. Now it filters by the authenticated user's ID:

```typescript
const getAll = (userId: string) => {
  return db.thesis.findMany({
    where: { status: { not: 'CLOSED' }, userId },
    orderBy: { createdAt: 'desc' },
  });
};
```

Two users signing in will each see only their own theses. This is the fundamental requirement for a multi-tenant system.

---

### Alert emails: fetching user email from Clerk

The alert service previously sent emails to `ev.thesis.user.email` — pulled from the now-deleted `User` table. Since Clerk holds user data, we fetch the email at send time using the Clerk backend SDK:

```typescript
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const user = await clerkClient.users.getUser(ev.thesis.userId);
const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
```

This is a network call per alert. That's acceptable for an infrequent event (alert fires when confidence ≥ threshold). Caching the email in the database is a future optimisation if it becomes a bottleneck.

---

### Frontend: ClerkProvider and UserButton

`ClerkProvider` wraps the entire app in `layout.tsx`. This is a React context provider that makes Clerk's hooks (`useAuth`, `useUser`) available anywhere in the component tree.

`UserButton` is Clerk's pre-built avatar/dropdown component. Clicking it shows the user's profile and a sign-out option. `afterSignOutUrl="/sign-in"` ensures the user lands on the login page after signing out. It sits in the nav bar with `ml-auto` to push it to the right.

---

### Frontend: Next.js middleware

`src/middleware.ts` runs on every request before it reaches a page. It uses Clerk's `clerkMiddleware` with a route matcher to decide what's public:

```typescript
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) auth().protect();
});
```

`auth().protect()` redirects unauthenticated users to `/sign-in` automatically. The `matcher` config in the export limits which requests Next.js runs the middleware on — static assets (`_next`, images, fonts) are excluded for performance.

---

### Frontend: useApi() hook

The original `api` object was a plain module-level constant — every call was unauthenticated. Clerk tokens are obtained asynchronously via `useAuth().getToken()`, which is a React hook and therefore can only be called inside a component or another hook.

The solution is a `useApi()` hook that captures `getToken` and wraps every request with a Bearer token:

```typescript
export function useApi() {
  const { getToken } = useAuth();

  async function authedRequest<T>(path, options) {
    const token = await getToken();
    return request<T>(path, options, token ?? undefined);
  }

  return { theses: { list: () => authedRequest('/theses'), ... }, ... };
}
```

Each page component calls `const api = useApi()` once and then uses `api.*` exactly as before — the call sites are unchanged. The token is fetched fresh on every request (Clerk caches it internally and handles refresh transparently).

---

### Sign-in and sign-up pages

Clerk provides `<SignIn />` and `<SignUp />` components that render a complete, styled auth UI. The routes use Next.js catch-all segments (`[[...sign-in]]`) so Clerk can handle its own sub-paths (e.g. `/sign-in/factor-one` for MFA) without needing additional route files.

---

### What comes next?

MVP 3 continues with:
- **Thesis health scores** — a rolling confidence trend derived from recent evaluations
- **Multi-channel alerts** — Slack webhooks alongside email

---

## TTA-015 — Thesis Health Score

### What is a health score?

A thesis doesn't just exist in a binary state of "right" or "wrong". It accumulates evidence over time — some news supports it, some weakens it. A trader looking at a thesis wants to know at a glance: *is this holding up?*

The health score answers that question as a single number: **0–100**. It is computed from the last 10 evaluations against a thesis and shown as a colour-coded badge on every thesis card and detail page.

---

### The formula

```
signed_confidence = confidence  (if SUPPORTS)
                  = -confidence (if WEAKENS)
                  = 0           (if NEUTRAL)

raw = sum(signed_confidence) / count   → range: [-100, +100]
health = round((raw + 100) / 2)        → range: [0, 100]
```

Example: 5 evaluations — two SUPPORTS at 80%, one WEAKENS at 60%, two NEUTRAL:

```
raw = (80 + 80 - 60 + 0 + 0) / 5 = 20
health = round((20 + 100) / 2) = 60  →  yellow
```

Using the last 10 evaluations (not all-time) keeps the score responsive to recent news while smoothing out single outliers.

---

### Where the score is computed

Health score is **computed in the service layer, not stored**. There is no `healthScore` column in the database. The `thesisService.getAll()` and `getById()` functions fetch the last 10 evaluations via a Prisma `include`, run `computeHealthScore()`, and attach the result to the returned object before it leaves the service.

```typescript
const HEALTH_INCLUDE = {
  evaluations: {
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { impactDirection: true, confidence: true },
  },
};
```

`take: 10` — Prisma applies this as a `LIMIT` in SQL, so only 10 rows are fetched per thesis regardless of how large the evaluation history is. The cost is O(1) per thesis, not O(n).

`select: { impactDirection, confidence }` — only the two fields needed for the computation are fetched. No unnecessary data transfer.

---

### Why not store the score?

Storing a derived value creates two sources of truth that can drift out of sync. If an evaluation is added and the stored score is not updated atomically, they diverge. Computing on read means the score is always exact and requires zero maintenance. At the scale of this product (tens of theses per user, 10 evaluations per query), the compute cost is negligible.

---

### Colour thresholds

| Score | Colour | Meaning |
|-------|--------|---------|
| 70–100 | Green | Thesis is well-supported by recent news |
| 40–69 | Yellow | Mixed signals — worth monitoring |
| 0–39 | Red | Thesis is under pressure from recent news |
| null | Hidden | No evaluations yet — score not shown |

`null` is the explicit case for a thesis with no evaluations. Showing "Health 50" (neutral midpoint) for a thesis with zero data would be misleading — so it's hidden entirely.

---

### PATCH response now includes health score

Previously, `PATCH /theses/:id` returned the raw Prisma `update()` result — a plain thesis object without health score. After this PR it calls `getById()` after the update, so the response includes the computed score. This matters for the alert threshold slider: when the user saves the threshold and the page syncs state from the response, it now has a valid health score too.

---

### What comes next?

- **Slack alerts** — webhook-based notifications as a second alert channel alongside email

