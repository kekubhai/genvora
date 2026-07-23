import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry tracing for a Node.js service.
 * Call this BEFORE any other imports so auto-instrumentations can hook require().
 */
export function initTracer(
  serviceName: string,
  options?: {
    endpoint?: string;
    serviceVersion?: string;
    logLevel?: DiagLogLevel;
  },
): void {
  const endpoint =
    options?.endpoint ?? process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] ?? "http://localhost:4317";

  const logLevel =
    process.env["OTEL_LOG_LEVEL"] === "debug"
      ? DiagLogLevel.DEBUG
      : options?.logLevel ?? DiagLogLevel.INFO;
  diag.setLogger(new DiagConsoleLogger(), logLevel);

  const traceExporter = new OTLPTraceExporter({ url: endpoint });

  sdk = new NodeSDK({
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
      new PrismaInstrumentation(),
    ],
  });

  sdk.start();

  const shutdown = async () => {
    if (sdk) {
      await sdk.shutdown();
      sdk = null;
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  console.log(
    JSON.stringify({
      level: "info",
      message: "OpenTelemetry tracer initialized",
      service: serviceName,
      endpoint,
      timestamp: new Date().toISOString(),
    }),
  );
}
