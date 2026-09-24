# @repo/ai-native-telemetry

What each published version changes for the packages that install it, and for the agents that load the skills shipped beside this file.

## 0.0.0

- `startTelemetry`, the one place a process starts its OpenTelemetry tracer, meter, and logger providers. The first caller fixes `service.name`, `MST_TELEMETRY` turns measurement on, `OTEL_SDK_DISABLED` turns it back off, an export failure sets `process.exitCode = 1`, and shutdown runs after every other `beforeExit` handler.
- `inheritedContext` and `environmentCarryingContext`, which read and write the W3C trace context through environment variables so a child process continues its parent's trace.
- `@repo/ai-native-telemetry/optional-setting`, whose `telemetryAsked` tells a config whether `MST_TELEMETRY` is defined.
- `@repo/ai-native-telemetry/vitest-sdk`, the entry Vitest's `experimental.openTelemetry.sdkPath` is pointed at.
- `@repo/ai-native-telemetry/vitest-sdk-path`, whose `sdkFilePath` turns the resolved URL of that entry into the absolute file path Vitest needs, so a Vite config needs no `node:url`.
