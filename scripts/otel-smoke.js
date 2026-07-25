/**
 * One-shot OTLP smoke test → SigNoz Foundry ingester.
 * Usage: node scripts/otel-smoke.js
 */
const { NodeSDK } = require("@opentelemetry/sdk-node");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-grpc");
const { trace } = require("@opentelemetry/api");

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4317";

async function main() {
  const sdk = new NodeSDK({
    serviceName: "genvora-worker",
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
  });
  sdk.start();

  const tracer = trace.getTracer("genvora-smoke");
  await tracer.startActiveSpan("activity.smoke_test", async (span) => {
    span.setAttribute("smoke", true);
    span.setAttribute("hackathon", "agents-of-signoz");
    await new Promise((r) => setTimeout(r, 50));
    span.end();
  });

  await sdk.shutdown();
  console.log(JSON.stringify({ ok: true, endpoint, service: "genvora-worker" }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
