const telemetryRelayHost = "otlp.vitest.internal";
const telemetryRelayUrl = `http://${telemetryRelayHost}/v1/traces`;
const browserRelayPath = "/__perf_otlp";

export { browserRelayPath, telemetryRelayHost, telemetryRelayUrl };
