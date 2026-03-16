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
