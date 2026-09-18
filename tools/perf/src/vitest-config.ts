import { browserRelayPath, telemetryRelayHost } from "./relay.ts";
import { build } from "vite/rolldown";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdtemp } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

interface OpenTelemetryOption {
  readonly browserSdkPath?: string;
  readonly enabled: boolean;
  readonly sdkPath?: string;
}

interface BrowserRelay {
  readonly changeOrigin: boolean;
  readonly rewrite: (path: string) => string;
  readonly target: string;
}

interface BrowserTelemetry {
  readonly openTelemetry: OpenTelemetryOption;
  readonly proxy: Readonly<Record<string, BrowserRelay>>;
}

interface WorkerdTelemetry {
  readonly openTelemetry: OpenTelemetryOption;
  readonly relay?: (request: Readonly<Request>) => Promise<Response> | undefined;
}

// oxlint-disable-next-line node/no-process-env
const traced = process.env["TRACEPARENT"] !== undefined;
// oxlint-disable-next-line node/no-process-env
const endpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];
const workerdConditions = ["workerd", "worker", "browser", "import", "default"];

function nodeTelemetry(): OpenTelemetryOption {
  return { enabled: traced, sdkPath: fileURLToPath(new URL("vitest.ts", import.meta.url)) };
}

function browserTelemetry(): BrowserTelemetry {
  if (!traced || endpoint === undefined) {
    return { openTelemetry: { enabled: false }, proxy: {} };
  }
  const relayPath: BrowserRelay = {
    changeOrigin: true,
    rewrite: (requestPath) => requestPath.slice(browserRelayPath.length),
    target: endpoint,
  };
  return {
    openTelemetry: {
      ...nodeTelemetry(),
      browserSdkPath: fileURLToPath(new URL("browser-sdk.ts", import.meta.url)),
    },
    proxy: { [browserRelayPath]: relayPath },
  };
}

async function relay(request: Readonly<Request>): Promise<Response> {
  const target = new URL(request.url);
  return fetch(`${String(endpoint).replace(/\/$/u, "")}${target.pathname}`, {
    body: await request.arrayBuffer(),
    headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
    method: request.method,
  });
}

function relayTelemetry(request: Readonly<Request>): Promise<Response> | undefined {
  return new URL(request.url).host === telemetryRelayHost ? relay(request) : undefined;
}

async function bundleWorkerdSdk(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "perf-workerd-sdk-"));
  const file = path.join(directory, "sdk.mjs");
  await build({
    external: [/^node:/u],
    input: fileURLToPath(new URL("workerd-sdk.ts", import.meta.url)),
    logLevel: "silent",
    output: { file, format: "esm" },
    platform: "browser",
    resolve: { conditionNames: workerdConditions },
  });
  return file;
}

async function workerdTelemetry(): Promise<WorkerdTelemetry> {
  if (!traced || endpoint === undefined) {
    return { openTelemetry: { enabled: false } };
  }
  return {
    openTelemetry: { enabled: true, sdkPath: await bundleWorkerdSdk() },
    relay: relayTelemetry,
  };
}

export { browserTelemetry, nodeTelemetry, workerdTelemetry };
