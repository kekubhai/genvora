import { All, Controller, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { createAuth } from "./auth.config";

// Lazy-initialize auth to avoid startup cost in tests
let _authPromise: Promise<Awaited<ReturnType<typeof createAuth>>> | null = null;

function getAuth(): Promise<Awaited<ReturnType<typeof createAuth>>> {
  if (!_authPromise) {
    _authPromise = createAuth();
  }
  return _authPromise;
}

/**
 * Catch-all controller that forwards all /auth/* requests to Better Auth.
 * Better Auth handles the full request/response lifecycle itself.
 */
@Controller("auth")
export class AuthController {
  @All("*")
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    const auth = await getAuth();

    // Convert Express req/res to Web API Request/Response compatible format
    // Better Auth's toNodeHandler bridges the gap
    const handler = auth.handler;

    // Build a full URL so Better Auth can parse the path
    const protocol = req.protocol ?? "http";
    const host = req.get("host") ?? "localhost:3001";
    const url = `${protocol}://${host}${req.originalUrl}`;

    // Reconstruct a Fetch-compatible Request from the Express request
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else {
          headers.set(key, value);
        }
      }
    }

    let body: string | null = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = JSON.stringify(req.body);
    }

    const fetchReq = new Request(url, {
      method: req.method,
      headers,
      body,
    });

    const response = await handler(fetchReq);

    // Forward status and headers back to Express response
    res.status(response.status);

    response.headers.forEach((value: string, key: string) => {
      res.setHeader(key, value);
    });

    const responseBody = await response.text();
    res.send(responseBody);
  }
}
