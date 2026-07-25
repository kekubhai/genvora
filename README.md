# Genvora

AI-powered multi-tenant SaaS platform built with Next.js, NestJS, and Cloudflare Workers.

## Architecture

### Frontend
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **Tremor** (charts)
- **Better Auth** (authentication client)

### Backend
- **NestJS** (API server)
- **Cloudflare Workers** (serverless functions)
- **Prisma** (ORM)
- **Better Auth** (authentication server)
- **Redis** (caching)

### Infrastructure
- **Supabase** (PostgreSQL + Storage)
- **Cloudflare Workers** (serverless compute)
- **Temporal** (job orchestration)
- **Redis** (caching & rate limiting)
- **SigNoz** via **Foundry** (`casting.yaml` — traces, metrics, logs, MCP)
- **Vercel** (frontend hosting)
- **Sentry** (error monitoring)
- **PostHog** (product analytics)

## Monorepo Structure

```
genvora/
├── apps/
│   ├── web/              # Next.js frontend
│   ├── api/               # NestJS backend API
│   └── worker/            # Temporal workers (OTEL → SigNoz)
├── packages/
│   ├── db/                # Prisma schema + migrations
│   ├── llm-client/         # LLM provider abstraction
│   ├── observability/      # OpenTelemetry tracer
│   ├── scoring-engine/     # Deterministic scoring logic
│   └── shared-types/      # Shared TypeScript types
├── casting.yaml            # SigNoz Foundry install (reproducible)
├── casting.yaml.lock       # Locked Foundry casting
├── pours/                  # Generated Compose (from foundryctl forge)
├── infra/
│   ├── docker-compose.yml  # Postgres, Redis, Temporal
│   └── signoz/             # Dashboard + alerts import
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Docker (for local infrastructure)
- Supabase account
- Cloudflare account

### 1. Clone and Install

```bash
git clone <repository-url>
cd genvora
npm install
```

### 2. Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Configure the following variables:

```bash
# Database (Supabase)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_DATABASE_URL="postgresql://postgres.[project-ref]:[password]@db.[project-ref].supabase.co:5432/postgres"

# Authentication
BETTER_AUTH_SECRET="your-secret-key"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Redis
REDIS_URL="redis://localhost:6379"

# Temporal
TEMPORAL_ADDRESS="localhost:7233"

# Observability
SENTRY_DSN="your-sentry-dsn"
NEXT_PUBLIC_SENTRY_DSN="your-sentry-dsn"
NEXT_PUBLIC_POSTHOG_KEY="your-posthog-key"
NEXT_PUBLIC_POSTHOG_HOST="https://app.posthog.com"

# Frontend
NEXT_PUBLIC_API_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"
API_BASE_URL="http://localhost:3001"

# Cloudflare Workers
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
```

### 3. Start Local Infrastructure

Start the local development services:

```bash
cd infra
docker-compose up -d
```

This will start:
- PostgreSQL (local database)
- Redis (local cache)
- Temporal (workflow orchestration)

### 3b. Start SigNoz (Foundry)

SigNoz is deployed separately with Foundry so judges can reproduce it from `casting.yaml` + `casting.yaml.lock`:

```bash
curl -fsSL https://signoz.io/foundry.sh | bash
foundryctl cast -f casting.yaml
```

- UI: http://localhost:8080  
- OTLP: `localhost:4317` / `4318`  
- MCP: http://localhost:8000  

See [infra/signoz/README.md](infra/signoz/README.md) for dashboard/alerts import and MCP setup.

### 4. Database Setup

Generate Prisma client and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

### 5. Development

Start all applications:

```bash
npm run dev
```

This will start:
- Next.js frontend: http://localhost:3000
- NestJS API: http://localhost:3001
- Temporal worker: background process

### 6. Cloudflare Workers Development

For Cloudflare Workers development:

```bash
npm run workers:dev
```

The worker will be available at http://localhost:8787

## Deployment

### Frontend (Vercel)

1. Connect your repository to Vercel
2. Set root directory to `apps/web`
3. Configure environment variables in Vercel dashboard
4. Deploy automatically on push to main branch

### Backend (Cloudflare Workers)

1. Install Wrangler CLI: `npm install -g wrangler`
2. Login: `wrangler login`
3. Set secrets:
   ```bash
   cd workers
   wrangler secret put DATABASE_URL
   wrangler secret put BETTER_AUTH_SECRET
   wrangler secret put SUPABASE_URL
   wrangler secret put SUPABASE_ANON_KEY
   ```
4. Deploy:
   ```bash
   npm run workers:deploy
   ```

### Temporal Worker

The Temporal worker can be deployed to any Node.js hosting platform or run as a container.

## Authentication

The platform uses Better Auth for authentication with:
- Email/password authentication
- Google OAuth
- Multi-tenant organizations
- Role-based access control (admin/member)

Authentication is managed via:
- **Backend**: Better Auth server in NestJS API
- **Frontend**: Better Auth React client in Next.js
- **Workers**: Better Auth integration in Cloudflare Workers

## Database

The database schema is managed via Prisma in `packages/db/prisma/schema.prisma`.

Key tables:
- `user`, `session`, `account` (Better Auth)
- `organization`, `member`, `invitation` (Multi-tenant)
- `site` (Domain model)

To regenerate types after schema changes:

```bash
npm run db:generate
```

To create migrations:

```bash
cd packages/db
npx prisma migrate dev --name migration_name
```

## Observability

### Sentry (Error Monitoring)

- Frontend errors: `NEXT_PUBLIC_SENTRY_DSN`
- Backend errors: `SENTRY_DSN`

### PostHog (Product Analytics)

- Frontend analytics: `NEXT_PUBLIC_POSTHOG_KEY`

## Health Checks

### API Health Check

```bash
GET http://localhost:3001/health
```

Response:
```json
{
  "status": "ok",
  "dependencies": {
    "postgres": "connected",
    "redis": "connected"
  }
}
```

### Cloudflare Workers Health Check

```bash
GET http://localhost:8787/health
```

Response:
```json
{
  "status": "ok",
  "dependencies": {
    "postgres": "connected",
    "supabase": "configured"
  },
  "environment": "development"
}
```

## Scripts

```bash
# Development
npm run dev              # Start all applications
npm run workers:dev      # Start Cloudflare Workers locally

# Building
npm run build            # Build all packages and apps

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run database migrations

# Quality
npm run lint             # Lint all packages
npm run typecheck        # Type check all packages
npm run format           # Format code with Prettier

# Deployment
npm run workers:deploy   # Deploy Cloudflare Workers
```

## License

Proprietary - All rights reserved
