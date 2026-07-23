import { DiagLogLevel } from "@opentelemetry/api";
/**
 * Initialize OpenTelemetry tracing for a Node.js service.
 * Call this BEFORE any other imports so auto-instrumentations can hook require().
 */
export declare function initTracer(serviceName: string, options?: {
    endpoint?: string;
    serviceVersion?: string;
    logLevel?: DiagLogLevel;
}): void;
