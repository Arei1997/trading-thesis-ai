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
