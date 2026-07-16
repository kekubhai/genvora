# Requirements Document

## Introduction

Phase 0 establishes the foundational infrastructure for a multi-tenant SaaS monorepo. The goal is to get infrastructure, authentication, and the deployment pipeline working end-to-end with zero product logic. This covers monorepo scaffolding, database connectivity, authentication with organizations and roles, job orchestration, caching, observability, and CI/CD deployment — providing a stable, deployable base for subsequent product phases.

## Glossary

- **Monorepo**: A single repository containing all apps and shared packages, managed by Turborepo or Nx
- **API**: The NestJS backend application (`apps/api`)
- **Web**: The Next.js frontend application (`apps/web`)
- **Worker**: The Temporal worker application (`apps/worker`)
- **DB_Package**: The shared Prisma package (`packages/db`) containing schema, migrations, and generated types
- **LLM_Client**: The shared package (`packages/llm-client`) abstracting LLM provider calls
- **Shared_Types**: The shared TypeScript types package (`packages/shared-types`)
- **Scoring_Engine**: The shared deterministic scoring package (`packages/scoring-engine`)
- **Prisma**: The ORM used by API and Worker to access Supabase Postgres
- **Better_Auth**: The self-hosted authentication library managing users, sessions, organizations, and roles
- **Temporal**: The workflow orchestration engine used to run crawling, scoring, and LLM jobs
- **Redis**: The in-memory data store used for caching and rate limiting
- **Supabase_Postgres**: The managed Postgres database (Supabase Postgres only — Supabase Auth is disabled)
- **Supabase_Storage**: The S3-compatible object storage service provided by Supabase
- **Organization**: A multi-tenant workspace unit; each tenant's data is scoped to an Organization
- **Member**: A user who belongs to an Organization with an assigned role (admin or member)
- **Invitation**: A pending invite linking an email address to an Organization
- **Pooled_Connection**: The Supabase Postgres connection string suitable for serverless/short-lived processes (PgBouncer)
- **Direct_Connection**: The Supabase Postgres connection string for long-running processes (Temporal activities)
- **Site**: A domain-scoped entity belonging to an Organization, added on top of the Better Auth schema
- **Sentry**: The error monitoring and alerting service
- **PostHog**: The product analytics service
- **Health_Check**: The `GET /health` endpoint that confirms API and database connectivity
- **Ping_Workflow**: The dummy Temporal workflow used to validate the Temporal pipeline

---

## Requirements

### Requirement 1: Monorepo Scaffold

**User Story:** As a developer, I want the repository scaffolded with Turborepo (or Nx) using the defined structure, so that all apps and packages share tooling, type-checking, and build pipelines from day one.

#### Acceptance Criteria

1. THE Monorepo SHALL contain the top-level directory structure: `apps/web`, `apps/api`, `apps/worker`, `packages/db`, `packages/llm-client`, `packages/scoring-engine`, `packages/shared-types`, and `infra/docker-compose.yml`.
2. THE Monorepo SHALL include a root-level `turbo.json` (or equivalent Nx config) that defines `build`, `lint`, and `typecheck` pipeline tasks such that all tasks in `packages/*` complete before dependent tasks in `apps/*` begin, as enforced by the `dependsOn` field.
3. THE Monorepo SHALL include a root `package.json` with workspaces configured so that packages in `apps/*` and `packages/*` are recognized as workspace members.
4. WHEN a developer runs the root-level build pipeline command, THE Monorepo SHALL exit with code 0 and produce compiled output artifacts for all apps and packages, without requiring any manual per-package invocation.
5. THE Monorepo SHALL include a root `.gitignore` that excludes `node_modules`, `.env*`, `dist`, and `.turbo` directories.
6. THE DB_Package SHALL re-export the Prisma client instance and all Prisma-generated TypeScript types so that `apps/api`, `apps/worker`, and other packages can import them directly from `@repo/db` without instantiating a second Prisma client.

---

### Requirement 2: Database Connectivity

**User Story:** As a developer, I want the API and Worker connected to Supabase Postgres via Prisma, so that all database access is type-safe and migration-managed from a single schema.

#### Acceptance Criteria

1. THE DB_Package SHALL contain the canonical `schema.prisma` file with the `datasource` block pointing to an environment variable `DATABASE_URL`.
2. THE API SHALL use the `Pooled_Connection` string as `DATABASE_URL` for its Prisma client instance.
3. THE Worker SHALL use the `Direct_Connection` string as `DATABASE_URL` for its Prisma client instance inside Temporal activities.
4. WHEN a developer runs `prisma migrate deploy` against a provisioned Supabase Postgres instance, THE DB_Package SHALL exit with code 0 with no migration errors written to stderr.
5. IF the database is unreachable when the API attempts to connect during startup, THEN THE API SHALL emit a structured log entry containing the dependency name ("postgres"), the failure reason, and a timestamp, then exit with a non-zero code.
6. THE DB_Package SHALL NOT have compile-time package dependencies on Supabase Auth — only Supabase Postgres and Supabase_Storage integrations are permitted.

---

### Requirement 3: Prisma Schema — Auth and Domain Models

**User Story:** As a developer, I want the Prisma schema to include all Better Auth tables plus the initial domain model, so that the database structure is fully migration-managed and the domain can be extended safely.

#### Acceptance Criteria

1. THE DB_Package SHALL generate Better Auth base models — `User`, `Session`, `Account`, `Verification` — by running `npx @better-auth/cli generate` after configuring the Better Auth instance with the organizations plugin.
2. THE DB_Package SHALL generate Better Auth organization models — `Organization`, `Member`, `Invitation` — by explicitly running `npx @better-auth/cli generate` with the organizations plugin enabled; the `schema.prisma` file MUST NOT contain `model Organization`, `model Member`, or `model Invitation` blocks that were written by hand without CLI invocation.
3. THE DB_Package SHALL include a `Site` model with fields: `id` (cuid, primary key), `organizationId` (foreign key to `Organization.id` with cascade delete), `domain` (String, unique, max 253 characters), and `createdAt` (DateTime, default now).
4. WHEN the Better Auth plugin configuration changes, THE DB_Package SHALL regenerate auth models via `npx @better-auth/cli generate` before any new domain models are appended, such that no domain model references a field or relation absent from the current generated auth models.
5. THE DB_Package SHALL NOT contain hand-written `model User` or `model Organization` blocks — the `schema.prisma` file MUST NOT contain those model definitions outside of content produced by the Better Auth CLI.
6. IF the `npx @better-auth/cli generate` command exits with a non-zero code, THEN the generation process SHALL halt and surface the CLI error output before any schema file is written or overwritten.

---

### Requirement 4: Authentication — API (Better Auth)

**User Story:** As a developer, I want Better Auth configured in the NestJS API with email/password, Google OAuth, and the organizations plugin, so that multi-tenant authentication is available from a single self-hosted service.

#### Acceptance Criteria

1. THE API SHALL expose the Better Auth handler at the route prefix `/auth/*` that processes all auth-related requests including sign-in, sign-up, session management, OAuth callbacks, org creation, invitations, and role management.
2. WHEN a user submits an email and password that match a stored account record, THE API SHALL create an authenticated session and return a session token in the response.
3. IF a user submits an email and password that do not match any stored account record, THEN THE API SHALL return HTTP 401 with a generic error message that does not reveal whether the email or password was incorrect.
4. WHEN a user completes the Google OAuth flow and no existing account is linked to that Google identity, THE API SHALL create a new account and return a session token.
5. WHEN a user completes the Google OAuth flow and an existing account is already linked to that Google identity, THE API SHALL return a session token for the existing account without creating a duplicate.
6. IF a user denies the Google OAuth consent or the OAuth flow fails, THEN THE API SHALL redirect to the sign-in page with an error query parameter.
7. WHEN an authenticated user creates an Organization, THE API SHALL record the Organization and assign the creator the `admin` role as a Member.
8. WHEN an admin sends an invitation to an email address, THE API SHALL create an Invitation record with `pending` status, linked to the Organization, with an expiry of 7 days from creation.
9. IF an admin sends an invitation to an email address that already has a `pending` Invitation for the same Organization, THEN THE API SHALL reject the request and return HTTP 409.
10. WHEN an invitee accepts a `pending` and non-expired Invitation, THE API SHALL create a Member record with the `member` role and set the Invitation status to `accepted`.
11. IF an invitee attempts to accept an Invitation that is expired or not in `pending` status, THEN THE API SHALL return HTTP 410.
12. IF an unauthenticated request reaches a protected Better Auth endpoint, THEN THE API SHALL return an HTTP 401 response.
13. THE API SHALL store all auth data — users, sessions, accounts, organizations, members, invitations — in Supabase_Postgres via Prisma, with no dependency on Supabase Auth.
14. THE API SHALL read the Better Auth secret from an environment variable `BETTER_AUTH_SECRET` and MUST NOT embed a secret value in source code.
15. IF `BETTER_AUTH_SECRET` is absent or empty at API startup, THEN THE API SHALL log the missing variable name and exit with a non-zero code.

---

### Requirement 5: Authentication — Web (Better Auth Client)

**User Story:** As a user, I want sign-in, sign-up, and protected-route enforcement in the Next.js frontend, so that I can authenticate and access my organization's workspace.

#### Acceptance Criteria

1. THE Web SHALL include sign-in and sign-up pages that use the Better Auth React/Next.js client to submit credentials to the API `/auth/*` route, process the server response, and establish the client-side session on success.
2. IF sign-in or sign-up credentials are rejected by the API, THEN THE Web SHALL display an error message on the same page without navigating away.
3. THE Web SHALL expose a `useSession` hook that returns `{ user, organization, status }` where `status` is one of `"loading"`, `"authenticated"`, or `"unauthenticated"`.
4. WHEN an unauthenticated user navigates to any route under `/dashboard` (or another explicitly defined protected path set), THE Web SHALL redirect the user to `/sign-in` via Next.js middleware before rendering the page.
5. WHEN a user signs out, THE Web SHALL call the Better Auth sign-out endpoint, remove the session cookie, and redirect to `/sign-in`.
6. THE Web SHALL read the API base URL from an environment variable (`NEXT_PUBLIC_API_URL`) and MUST NOT hardcode any API hostname.
7. WHERE Google OAuth is enabled, THE Web SHALL display a "Sign in with Google" button on the sign-in page that, when clicked, initiates the OAuth redirect flow to the API's Google OAuth endpoint.
8. IF a new user submits a sign-up form with an email address already registered, THEN THE Web SHALL display a conflict error message without navigating away.

---

### Requirement 6: API Health Check

**User Story:** As an operator, I want a health-check endpoint on the NestJS API, so that load balancers, deployment platforms, and uptime monitors can verify the service is running and the database is reachable.

#### Acceptance Criteria

1. IF all dependencies are healthy, THEN THE API SHALL return HTTP 200 with a JSON body `{ "status": "ok", "dependencies": { "postgres": "connected", "redis": "connected" } }` from the `GET /health` endpoint.
2. WHEN the `GET /health` endpoint is called, THE API SHALL verify Postgres connectivity by executing a lightweight query (e.g., `SELECT 1`) via Prisma.
3. IF the Postgres connectivity check fails, THEN THE API SHALL return HTTP 503 with a JSON body indicating which dependency is unhealthy.
4. WHEN the `GET /health` endpoint is called, THE API SHALL respond within 2000ms.
5. THE Health_Check endpoint SHALL be accessible without authentication.

---

### Requirement 7: Temporal Worker Pipeline

**User Story:** As a developer, I want a Temporal worker connected to a local Temporal server with a passing "ping" workflow, so that the job orchestration pipeline is proven end-to-end before any product workflows are built.

#### Acceptance Criteria

1. THE `infra/docker-compose.yml` SHALL include service definitions for: a PostgreSQL instance for Temporal's persistence, the Temporal server itself, the Temporal UI, and the Worker application.
2. WHEN the Worker successfully connects to the Temporal server, THE Worker SHALL emit a structured log entry confirming the connection (e.g., `{ "level": "info", "message": "Connected to Temporal", "address": "<TEMPORAL_ADDRESS>" }`).
3. THE Worker SHALL register a `Ping_Workflow` on the task queue `ping-task-queue` that accepts no input and returns the string `"pong"`.
4. WHEN the `Ping_Workflow` is executed via a Temporal client targeting `ping-task-queue`, THE Worker SHALL return `"pong"` within 5000ms.
5. THE Worker SHALL read the Temporal server address from environment variable `TEMPORAL_ADDRESS`, defaulting to `localhost:7233` if the variable is not set.
6. THE Worker MUST NOT contain any hardcoded Temporal server address strings in source code.
7. IF the Temporal server is unreachable at Worker startup, THEN THE Worker SHALL emit a JSON-structured log entry with fields `level`, `message`, and `error`, immediately exit with a non-zero code, and SHALL NOT perform any retry attempts before exiting.

---

### Requirement 8: Redis Connection

**User Story:** As a developer, I want a Redis connection available in the API, so that caching and rate limiting can be implemented in later phases without infrastructure changes.

#### Acceptance Criteria

1. THE `infra/docker-compose.yml` SHALL include a Redis service definition.
2. WHEN the API starts, THE API SHALL initialize a Redis client using the connection URL from environment variable `REDIS_URL`.
3. IF the Redis connection fails at startup, THEN THE API SHALL log a structured warning and continue operation such that non-Redis-dependent endpoints remain available; Redis-dependent operations SHALL return a degraded-state indicator rather than causing an unhandled exception.
4. THE API SHALL expose a `redis` field in the `GET /health` response body with the value `"connected"` when the Redis client is healthy or `"unavailable"` when it is not.
5. THE API SHALL read the Redis connection URL exclusively from `REDIS_URL` environment variable and MUST NOT hardcode any Redis hostname, port, or connection string anywhere in the codebase.

---

### Requirement 9: Deployment Pipeline

**User Story:** As a developer, I want the frontend deployed to Vercel and the backend and worker deployed to Railway with environment variables and secrets properly managed, so that the system is reachable in a production-like environment from the end of Phase 0.

#### Acceptance Criteria

1. IF the monorepo is connected to Vercel, THEN THE Web SHALL be deployable by configuring `apps/web` as the root directory, either via Vercel project settings or a `vercel.json` file with the correct `rootDirectory` field.
2. IF `apps/api` is connected to Railway, THEN THE API SHALL be deployable using a `Dockerfile` or Nixpacks configuration present in `apps/api`.
3. IF `apps/worker` is connected to Railway, THEN THE Worker SHALL be deployable using a `Dockerfile` or Nixpacks configuration present in `apps/worker`.
4. WHEN deployed, THE API SHALL read all secrets — `DATABASE_URL`, `BETTER_AUTH_SECRET`, `REDIS_URL`, `SENTRY_DSN` — exclusively from environment variables injected by the hosting platform.
5. WHEN deployed, THE Web SHALL read all public configuration — `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_SENTRY_DSN` — exclusively from environment variables injected by Vercel.
6. THE Monorepo SHALL include an `.env.example` file at the root listing all of the following required environment variable keys with placeholder values and inline comments: `DATABASE_URL`, `DIRECT_DATABASE_URL`, `BETTER_AUTH_SECRET`, `REDIS_URL`, `SENTRY_DSN`, `TEMPORAL_ADDRESS`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, and any OAuth client ID/secret variables.
7. IF any required environment variable is absent (not set) or empty (set to an empty string) at API startup, THEN THE API SHALL write the missing variable's name to stderr and exit with a non-zero code.
8. IF any required environment variable is absent or empty at Worker startup, THEN THE Worker SHALL write the missing variable's name to stderr and exit with a non-zero code.

---

### Requirement 10: Observability

**User Story:** As a developer, I want Sentry error monitoring in both the API and Web, and PostHog product analytics in the Web, so that errors and usage patterns are captured from the first deployment.

#### Acceptance Criteria

1. THE API SHALL initialize Sentry on startup using the DSN from environment variable `SENTRY_DSN` and automatically capture all unhandled exceptions.
2. WHEN a developer calls `Sentry.captureException()` or `Sentry.captureMessage()` explicitly in the API, THE API SHALL transmit that event to Sentry regardless of whether an unhandled exception occurred.
3. THE Web SHALL initialize Sentry using the DSN from environment variable `NEXT_PUBLIC_SENTRY_DSN` and capture all unhandled client-side and server-side exceptions.
4. WHEN an unhandled exception occurs in the API, THE API SHALL report the event to Sentry including the request context (method, path, and status code) and MUST NOT include raw user passwords, session tokens, or Authorization header values in the payload.
5. WHEN an unhandled exception occurs in the Web, THE Web SHALL report the event to Sentry including the current URL and page context.
6. IF `SENTRY_DSN` is not set, THEN THE API SHALL log a warning at startup and continue operation with Sentry initialized in no-op mode (events silently dropped rather than sent).
7. IF `NEXT_PUBLIC_SENTRY_DSN` is not set, THEN THE Web SHALL initialize Sentry in no-op mode without throwing an error.
8. IF `NEXT_PUBLIC_POSTHOG_KEY` is not set, THEN THE Web SHALL initialize PostHog in a no-op mode without throwing an error.
9. THE Web SHALL initialize PostHog using the project API key from environment variable `NEXT_PUBLIC_POSTHOG_KEY` and automatically capture page views when the key is present.
