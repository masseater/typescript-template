import type { ErrorEvent, StackFrame } from "@sentry/react";
import { validRequestId, validTraceId } from "./protocol.ts";

function safeFrame(frame: StackFrame): StackFrame {
  const filename = frame.filename?.split(/[?#]/, 1)[0];
  return {
    ...(filename && /^(https?:\/\/[^/]+\/assets\/|\/assets\/|[\w./-]+\.[cm]?js$)/.test(filename)
      ? { filename }
      : {}),
    ...(frame.lineno === undefined ? {} : { lineno: frame.lineno }),
    ...(frame.colno === undefined ? {} : { colno: frame.colno }),
    ...(frame.in_app === undefined ? {} : { in_app: frame.in_app }),
  };
}

export type SentryConfiguration = { dsn?: string; environment: string; release: string };

export function sentryBoundary(input: SentryConfiguration) {
  if (
    !/^[a-z0-9.-]{1,64}$/.test(input.environment) ||
    !/^[a-zA-Z0-9._-]{1,128}$/.test(input.release)
  )
    throw new Error("Invalid Sentry environment or release");
  if (input.dsn) {
    const dsn = new URL(input.dsn);
    if (dsn.protocol !== "https:" || !dsn.username || dsn.password || dsn.search || dsn.hash)
      throw new Error("Invalid Sentry DSN");
  }
  return {
    enabled: Boolean(input.dsn),
    sendDefaultPii: false as const,
    environment: input.environment,
    release: input.release,
    ...(input.dsn ? { dsn: input.dsn } : {}),
    tracesSampleRate: 0,
    enableLogs: false,
    autoSessionTracking: false,
    sendClientReports: false,
    beforeSend: (event: ErrorEvent): ErrorEvent | null => {
      if (!input.dsn) return null;
      return {
        type: undefined,
        ...(event.event_id ? { event_id: event.event_id } : {}),
        ...(event.timestamp === undefined ? {} : { timestamp: event.timestamp }),
        platform: "javascript",
        level: "error",
        environment: input.environment,
        release: input.release,
        tags: {
          ...(validRequestId(event.tags?.["request_id"])
            ? { request_id: event.tags["request_id"] }
            : {}),
          ...(validTraceId(event.tags?.["otel_trace_id"])
            ? { otel_trace_id: event.tags["otel_trace_id"] }
            : {}),
        },
        exception: {
          values: (event.exception?.values ?? []).map((exception) => ({
            type: /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(exception.type ?? "")
              ? (exception.type ?? "Error")
              : "Error",
            value: "Application error; inspect the correlated local telemetry",
            ...(exception.stacktrace
              ? { stacktrace: { frames: exception.stacktrace.frames?.map(safeFrame) ?? [] } }
              : {}),
          })),
        },
      };
    },
    beforeSendTransaction: (): null => null,
    beforeBreadcrumb: (): null => null,
  };
}
