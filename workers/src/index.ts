import { PrismaClient } from '@prisma/client';
import { PrismaPG } from '@prisma/adapter-pg';

// Interface for Cloudflare Workers fetch
export interface Env {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ENVIRONMENT?: string;
  // Supabase specific
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

// Global Prisma client for Cloudflare Workers
let prisma: PrismaClient | null = null;

function getPrisma(env: Env): PrismaClient {
  if (!prisma) {
    // For Cloudflare Workers, we need to use the direct connection string
    // Cloudflare Workers don't support connection pooling the same way
    const adapter = new PrismaPG({
      connectionString: env.DATABASE_URL,
    });
    prisma = new PrismaClient({ 
      adapter,
      log: ['query', 'error', 'warn'],
    });
  }
  return prisma;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check endpoint
    if (path === '/health') {
      try {
        const prismaClient = getPrisma(env);
        await prismaClient.$queryRaw`SELECT 1`;
        
        return Response.json({
          status: 'ok',
          dependencies: {
            postgres: 'connected',
            supabase: env.SUPABASE_URL ? 'configured' : 'not configured',
          },
          environment: env.ENVIRONMENT || 'unknown',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        return Response.json({
          status: 'error',
          dependencies: {
            postgres: 'unavailable',
            supabase: env.SUPABASE_URL ? 'configured' : 'not configured',
          },
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        }, { status: 503 });
      }
    }

    // Auth endpoints (proxy to Better Auth logic - simplified for now)
    if (path.startsWith('/auth/')) {
      return handleAuthRequest(request, env);
    }

    // 404 for unknown routes
    return Response.json({ error: 'Not found' }, { status: 404 });
  },
};

async function handleAuthRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Basic auth endpoint placeholders
  if (path === '/auth/sign-in' && request.method === 'POST') {
    try {
      const body = await request.json() as { email: string; password: string };
      
      // TODO: Implement actual Better Auth integration
      // For now, return a placeholder response
      return Response.json({
        error: 'Better Auth integration not yet implemented in Cloudflare Workers',
        note: 'This is a placeholder - full Better Auth integration requires additional setup',
      }, { status: 501 });
    } catch (error) {
      return Response.json({
        error: 'Invalid request body',
      }, { status: 400 });
    }
  }

  return Response.json({ error: 'Auth endpoint not implemented' }, { status: 501 });
}
