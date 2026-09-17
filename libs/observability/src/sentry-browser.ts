import { optional, parse, strictObject, string } from "valibot";
import type { InferOutput } from "valibot";
import type { SentryConfiguration } from "./sentry.ts";
import { init } from "@sentry/react";
import { sentryBoundary } from "./sentry.ts";

type SentryClient = ReturnType<typeof init>;

const closeTimeoutMilliseconds = 1000;
const unavailableMessage = "Optional error exporter configuration unavailable";
const sentrySettings = strictObject({ dsn: string(), environment: string(), release: string() });
const clientConfig = strictObject({ sentry: optional(sentrySettings) });

function startBrowserSentry(configuration: SentryConfiguration): SentryClient {
  const options = sentryBoundary(configuration);
  return options.enabled ? init({ ...options, tracePropagationTargets: [] }) : undefined;
}

async function readClientConfig(signal: AbortSignal): Promise<InferOutput<typeof clientConfig>> {
  const response = await fetch("/api/client-config", {
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    signal,
  });
  if (!response.ok) {
    throw new Error("Could not read browser telemetry configuration");
  }
  return parse(clientConfig, await response.json());
}

async function connect(signal: AbortSignal): Promise<SentryClient> {
  try {
    const configuration = await readClientConfig(signal);
    if (signal.aborted || configuration.sentry === undefined) {
      return undefined;
    }
    return startBrowserSentry(configuration.sentry);
  } catch {
    if (!signal.aborted) {
      globalThis.dispatchEvent(
        new ErrorEvent("error", {
          error: new Error(unavailableMessage),
          message: unavailableMessage,
        }),
      );
    }
    return undefined;
  }
}

async function disconnect(pending: Promise<SentryClient>): Promise<void> {
  const client = await pending;
  await client?.close(closeTimeoutMilliseconds);
}

function connectBrowserSentry(): () => void {
  const controller = new AbortController();
  const pending = connect(controller.signal);
  return () => {
    controller.abort();
    void disconnect(pending);
  };
}

export { connectBrowserSentry };
