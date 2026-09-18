import { BatchSpanProcessor, NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";

const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({ "service.name": "vitest" }),
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
});
provider.register();

// oxlint-disable-next-line import/no-default-export
export default provider;
