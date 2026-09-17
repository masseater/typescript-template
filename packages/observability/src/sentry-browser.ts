import { init } from "@sentry/react";
import * as v from "valibot";
import { sentryBoundary } from "./sentry.ts";
import type { SentryConfiguration } from "./sentry.ts";

function initBrowserSentry(configuration: SentryConfiguration): () => void {
  const options = sentryBoundary(configuration);
  if (!options.enabled) return () => undefined;
  const client = init({ ...options, tracePropagationTargets: [] });
  return () => {
    if (client) void client.close(1000);
  };
}

const clientConfig = v.strictObject({
  sentry: v.nullable(
    v.strictObject({
      dsn: v.string(),
      environment: v.string(),
      release: v.string(),
    }),
  ),
});

export function connectBrowserSentry(): () => void {
  const controller = new AbortController();
  let dispose: (() => void) | undefined;
  void fetch("/api/client-config", {
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error("Could not read browser telemetry configuration");
      const configuration = v.parse(clientConfig, (await response.json()) as unknown);
      if (!controller.signal.aborted && configuration.sentry)
        dispose = initBrowserSentry(configuration.sentry);
      return undefined;
    })
    .catch(() => {
      if (!controller.signal.aborted)
        window.dispatchEvent(
          new ErrorEvent("error", {
            error: new Error("Optional error exporter configuration unavailable"),
            message: "Optional error exporter configuration unavailable",
          }),
        );
    });
  return () => {
    controller.abort();
    dispose?.();
  };
}
