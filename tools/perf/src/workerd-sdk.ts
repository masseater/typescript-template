import { BasicTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { context, propagation, trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { WorkerdContextManager } from "./workerd-context.ts";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { telemetryRelayUrl } from "./relay.ts";

const provider = new BasicTracerProvider({
  resource: resourceFromAttributes({ "service.name": "vitest" }),
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: telemetryRelayUrl }))],
});
trace.setGlobalTracerProvider(provider);
propagation.setGlobalPropagator(new W3CTraceContextPropagator());
context.setGlobalContextManager(new WorkerdContextManager());

// oxlint-disable-next-line import/no-default-export
export default provider;
