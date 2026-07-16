# Cloudflare Workers Setup

This directory contains the Cloudflare Workers configuration for deploying serverless functions that connect to Supabase.

## Prerequisites

- Node.js 20+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account
- Supabase project

## Setup

### 1. Install Dependencies

```bash
cd workers
npm install
```

### 2. Configure Wrangler

Login to Cloudflare:

```bash
wrangler login
```

### 3. Set Environment Variables

Set the required secrets for your Cloudflare Worker:

```bash
# Database connection (use direct connection for Cloudflare Workers)
wrangler secret put DATABASE_URL

# Better Auth secret
wrangler secret put BETTER_AUTH_SECRET

# Google OAuth (optional)
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET

# Supabase configuration
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
```

For the `DATABASE_URL`, use the **direct connection string** from Supabase (not the pooled connection string):
```
postgresql://postgres.[project-ref]:[password]@db.[project-ref].supabase.co:5432/postgres
```

### 4. Generate Prisma Client

```bash
cd workers
npx prisma generate
```

### 5. Local Development

Run the worker locally:

```bash
npm run dev
```

The worker will be available at `http://localhost:8787`

### 6. Deploy to Cloudflare

Deploy to production:

```bash
npm run deploy
```

Deploy to staging:

```bash
wrangler deploy --env staging
```

## Available Endpoints

### Health Check

```bash
GET /health
```

Returns the health status of the worker and its database connection.

Response:
```json
{
  "status": "ok",
  "dependencies": {
    "postgres": "connected",
    "supabase": "configured"
  },
  "environment": "production",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Auth Endpoints

Auth endpoints are currently placeholders and need to be implemented with Better Auth integration:

```bash
POST /auth/sign-in
POST /auth/sign-up
```

## Database Schema

The Prisma schema in `workers/prisma/schema.prisma` should be kept in sync with the main schema in `packages/db/prisma/schema.prisma`.

When you update the main schema, you should:

1. Copy the updated schema to `workers/prisma/schema.prisma`
2. Regenerate the Prisma client: `npx prisma generate`
3. Deploy the worker: `npm run deploy`

## Architecture

- **Prisma**: ORM for database access via PrismaPG adapter
- **Supabase**: Direct PostgreSQL connection for data storage
- **Cloudflare Workers**: Serverless compute platform
- **Better Auth**: Authentication (to be implemented)

## Notes

- Cloudflare Workers have limited connection pools, so we use the direct Supabase connection string
- Session persistence is disabled for Supabase auth since Workers don't have persistent storage
- The worker includes basic health checks to verify database connectivity
- All sensitive data is stored as Cloudflare secrets, not in the code

## Troubleshooting

### Database Connection Issues

If you get database connection errors:
- Verify your `DATABASE_URL` is correct (use direct connection, not pooled)
- Check that your Supabase project allows connections from Cloudflare IPs
- Ensure the database user has the necessary permissions

### Prisma Generation Issues

If Prisma generation fails:
- Make sure you're using the correct schema file
- Check that your `DATABASE_URL` is set for local development
- Verify the Prisma adapter is correctly installed

### Deployment Issues

If deployment fails:
- Check that all secrets are properly set
- Verify your Cloudflare account has the necessary permissions
- Check the Cloudflare dashboard for deployment logs
