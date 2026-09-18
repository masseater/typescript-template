// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

interface OpenTelemetryOption {
  readonly browserSdkPath?: string;
  readonly enabled: boolean;
  readonly sdkPath?: string;
}

interface Traced {
  readonly endpoint: string;
  readonly workerdSdk: string;
}

function tracedRun(): Traced | undefined {
  // oxlint-disable-next-line node/no-process-env
  const { OTEL_EXPORTER_OTLP_ENDPOINT, PERF_TRACE_DIRECTORY, PERF_WORKERD_SDK } = process.env;
  return PERF_TRACE_DIRECTORY === undefined ||
    OTEL_EXPORTER_OTLP_ENDPOINT === undefined ||
    PERF_WORKERD_SDK === undefined
    ? undefined
    : { endpoint: OTEL_EXPORTER_OTLP_ENDPOINT, workerdSdk: PERF_WORKERD_SDK };
}

const SERVICE_UNAVAILABLE = 503;
const traced = tracedRun();
const nodeSdk = fileURLToPath(new URL("node-sdk.ts", import.meta.url));
const browserSdk = fileURLToPath(new URL("browser-sdk.ts", import.meta.url));

function nodeTelemetry(): OpenTelemetryOption {
  return traced === undefined ? { enabled: false } : { enabled: true, sdkPath: nodeSdk };
}

function workerdTelemetry(): OpenTelemetryOption {
  return traced === undefined ? { enabled: false } : { enabled: true, sdkPath: traced.workerdSdk };
}

function browserTelemetry(): {
  readonly define: Readonly<Record<string, string>>;
  readonly openTelemetry: OpenTelemetryOption;
} {
  return traced === undefined
    ? { define: {}, openTelemetry: { enabled: false } }
    : {
        define: { PERF_OTLP_TRACES_URL: JSON.stringify(`${traced.endpoint}/v1/traces`) },
        openTelemetry: { browserSdkPath: browserSdk, enabled: true, sdkPath: nodeSdk },
      };
}

async function passThrough(request: Readonly<Request>): Promise<Response> {
  try {
    return await fetch(request.url, {
      body: await request.arrayBuffer(),
      headers: request.headers,
      method: request.method,
    });
  } catch {
    process.stderr.write(
      `${JSON.stringify({ event: "perf.telemetry_export_failed", ok: false, url: request.url })}\n`,
    );
    return new Response(undefined, { status: SERVICE_UNAVAILABLE });
  }
}

function forwardTelemetry(request: Readonly<Request>): Promise<Response> | undefined {
  return traced !== undefined && new URL(request.url).origin === new URL(traced.endpoint).origin
    ? passThrough(request)
    : undefined;
}

export { browserTelemetry, forwardTelemetry, nodeTelemetry, workerdTelemetry };
