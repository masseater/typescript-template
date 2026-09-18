import { BatchSpanProcessor, WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { browserRelayPath } from "./relay.ts";
import { resourceFromAttributes } from "@opentelemetry/resources";

const url = new URL(`${browserRelayPath}/v1/traces`, import.meta.url).href;
const provider = new WebTracerProvider({
  resource: resourceFromAttributes({ "service.name": "vitest" }),
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url }))],
});
provider.register();

// oxlint-disable-next-line import/no-default-export
export default provider;
