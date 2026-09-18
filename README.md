# 🤖 Genvora

> AI-powered multi-tenant SaaS platform for **AI Readiness Audits**

Genvora helps organizations analyze and optimize their websites for AI/LLM consumption through automated scoring, structured data validation, and actionable recommendations.

---

## ✨ Features

- **🔍 Automated Website Scanning** — Crawl and analyze sites with AI-powered agents
- **📊 Comprehensive Scoring** — Structure, accessibility, semantic HTML, crawlability, and structured data
- **🏢 Multi-Tenant SaaS** — Organization management with role-based access control
- **🤖 AI-Enhanced Analysis** — LLM-powered recommendations and insights
- **⚡ Real-Time Workflows** — Temporal-powered audit pipelines
- **📈 Full Observability** — SigNoz traces, Sentry error tracking, PostHog analytics
- **🚀 Edge Computing** — Cloudflare Workers for global performance

---

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js 14    │    │   NestJS API    │    │ Cloudflare Wkrs │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│   (Serverless)  │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         └──────────────────────┴──────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Supabase (Postgres)   │
                    │   + Redis + Temporal    │
                    └─────────────────────────┘
```

### Tech Stack

**Frontend**
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Better Auth (authentication)

**Backend**
- NestJS (API server)
- Cloudflare Workers (serverless)
- Prisma (ORM)
- Better Auth (auth server)

**Infrastructure**
- Supabase (PostgreSQL + Storage)
- Temporal (workflow orchestration)
- Redis (caching)
- SigNoz (observability)
- Vercel (frontend hosting)

---

## 📁 Monorepo Structure

```
genvora/
├── apps/
│   ├── web/              # Next.js frontend
│   ├── api/              # NestJS backend API
│   └── worker/           # Temporal workers
├── packages/
│   ├── db/               # Prisma schema + migrations
│   ├── llm-client/       # LLM provider abstraction
│   ├── observability/    # OpenTelemetry tracer
│   ├── scoring-engine/   # Deterministic scoring logic
│   └── shared-types/     # Shared TypeScript types
├── infra/
│   ├── docker-compose.yml # Local dev stack
│   └── signoz/           # Observability setup
└── casting.yaml          # SigNoz Foundry config
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- Docker (for local infrastructure)
- Supabase account
- Cloudflare account

### 1. Install

```bash
git clone <repository-url>
cd genvora
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Infrastructure

```bash
cd infra
docker-compose up -d
```

### 4. Setup Database

```bash
npm run db:generate
npm run db:migrate
```

### 5. Run Development

```bash
npm run dev
```

🎉 Open [http://localhost:3000](http://localhost:3000)

---

## 🔐 Authentication

Genvora uses **Better Auth** for secure authentication:

- ✅ Email/password authentication
- ✅ Google OAuth
- ✅ Multi-tenant organizations
- ✅ Role-based access control (admin/member)
- ✅ Cross-origin support for Vercel + Cloudflare Workers

### Production Setup

For Vercel frontend + Cloudflare Workers backend:

1. **Set Vercel Environment Variables:**
   ```
   NEXT_PUBLIC_API_URL=https://your-api.workers.dev
   NEXT_PUBLIC_POSTHOG_KEY=your-key
   NEXT_PUBLIC_SENTRY_DSN=your-dsn
   ```

2. **Configure Cloudflare Workers Secrets:**
   ```bash
   cd apps/api
   wrangler secret put DATABASE_URL
   wrangler secret put BETTER_AUTH_SECRET
   wrangler secret put SUPABASE_URL
   wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```

3. **Deploy:**
   ```bash
   npm run workers:deploy
   ```

---

## 📊 Scoring Engine

Genvora analyzes websites across 5 key categories:

| Category | Weight | Metrics |
|----------|--------|---------|
| **Structure** | 20% | Heading hierarchy, semantic ratio, alt text, internal links |
| **Accessibility** | 15% | ARIA labels, form labels, color contrast |
| **Semantic** | 15% | Semantic HTML tags, main/nav/footer identification |
| **Crawlability** | 30% | robots.txt, llms.txt, JS rendering, response codes |
| **Structured Data** | 20% | JSON-LD presence, schema types, required fields |

---

## 🔧 Development

### Available Scripts

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
npm run cf:deploy:api    # Deploy API to Cloudflare
npm run cf:deploy:web    # Deploy Web to Cloudflare
```

### Observability

**SigNoz** (Traces, Metrics, Logs)
```bash
curl -fsSL https://signoz.io/foundry.sh | bash
foundryctl cast -f casting.yaml
# UI: http://localhost:8080
```

**Sentry** (Error Monitoring)
- Frontend: `NEXT_PUBLIC_SENTRY_DSN`
- Backend: `SENTRY_DSN`

**PostHog** (Analytics)
- Frontend: `NEXT_PUBLIC_POSTHOG_KEY`

---

## 🌐 Deployment

### Frontend (Vercel)

1. Connect repository to Vercel
2. Set root directory to `apps/web`
3. Configure environment variables
4. Deploy automatically on push to main

### Backend (Cloudflare Workers)

```bash
npm run cf:deploy:api
```

### Temporal Worker

Deploy to any Node.js hosting platform or run as a container.

---

## 📡 Health Checks

**API Health Check**
```bash
GET http://localhost:3001/health
```

**Workers Health Check**
```bash
GET http://localhost:8787/health
```

---

## 🛠️ Troubleshooting

### Sign-in Issues

1. Ensure `NEXT_PUBLIC_API_URL` is set correctly
2. Verify API server is running on port 3001
3. Check `BETTER_AUTH_SECRET` is configured
4. Run database migrations: `npm run db:migrate`

### Cross-Origin Issues

For local development, always use `http://localhost:3001` as the API URL to avoid CORS problems.

---

## 📄 License

Proprietary — All rights reserved

---

## 🤝 Contributing

This is a proprietary project. For questions or support, please contact the development team.

---

**Built with ❤️ for the future of AI-ready web**
