---
name: core
description: >
  Measure a process with @repo/ai-native-telemetry: `startTelemetry(serviceName)` registers one OpenTelemetry tracer, meter, and logger provider per process and exports them over OTLP when `MST_TELEMETRY` is defined, `inheritedContext` and `environmentCarryingContext` carry the trace across a child process through environment variables, and `@repo/ai-native-telemetry/vitest-sdk` is the entry for Vitest's `experimental.openTelemetry.sdkPath`, switched by `telemetryAsked` from `@repo/ai-native-telemetry/optional-setting`. Load when a command or a test block has to report spans, metrics, or log records, when spans arrive under the wrong service name, when a run that succeeded exits 1 after measuring, or when a child process starts a trace of its own instead of continuing its parent's.

metadata:
  type: core
  library: "@repo/ai-native-telemetry"
  library_version: "0.0.0"
sources:
  - "masseater/typescript-template:libs/telemetry/src/features/telemetry/telemetry.ts"
  - "masseater/typescript-template:libs/telemetry/src/features/telemetry/context-carrier.ts"
  - "masseater/typescript-template:libs/telemetry/src/features/telemetry/optional-setting.ts"
  - "masseater/typescript-template:libs/telemetry/src/features/telemetry/vitest-sdk.ts"
---

# @repo/ai-native-telemetry — one OpenTelemetry provider per process

```ts
import { startTelemetry } from "@repo/ai-native-telemetry";

const telemetry = startTelemetry("my-command");
```

Nothing is measured unless `MST_TELEMETRY` is defined. When it is, spans, metrics, and log records are exported over OTLP HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT`, and `OTEL_SDK_DISABLED=true` turns measurement back off without unsetting the first variable.

## Core Patterns

### Start the provider once, at the process entry

`startTelemetry` is memoized for the life of the process, so the first caller fixes `service.name` for everything measured in it. Shutdown is registered on `beforeExit` through a microtask, which puts it after every other `beforeExit` handler regardless of registration order; anything of your own that must run before the exporter stops has to register its own handler rather than rely on ordering.

### Measure a Vitest test block

```ts
import { telemetryAsked } from "@repo/ai-native-telemetry/optional-setting";
import { sdkFilePath } from "@repo/ai-native-telemetry/vitest-sdk-path";

const openTelemetry = {
  enabled: telemetryAsked,
  sdkPath: sdkFilePath(import.meta.resolve("@repo/ai-native-telemetry/vitest-sdk")),
};
```

Hand this object to `test.experimental.openTelemetry`. `sdkPath` has to be an absolute file path: Vitest resolves it against its `root`, which is the package directory, not the repository root. `sdkFilePath` turns the resolved URL into that path without `node:url`.

### Continue the parent's trace in a child process

```ts
import { environmentCarryingContext, inheritedContext } from "@repo/ai-native-telemetry";

const childEnvironment = environmentCarryingContext();
const parentContext = inheritedContext();
```

Pass `environmentCarryingContext()` as the child's environment, and start the child's spans under `inheritedContext()`, so both processes report one trace.

## Common Mistakes

### [HIGH] a sink that is not listening while MST_TELEMETRY is set

Wrong:

```sh
MST_TELEMETRY=1 vp test run
```

Correct:

```sh
MST_TELEMETRY=1 OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 vp test run
```

An export failure sets `process.exitCode = 1` and writes the reason to stderr, so a command that succeeded still reports failure when nothing receives the telemetry. Unset `MST_TELEMETRY` rather than leaving it pointed at nothing.

Source: masseater/typescript-template:tools/ai-native-telemetry/src/features/ai-native-telemetry/telemetry/telemetry.ts

### [MEDIUM] telemetry started a second time under a different name

Wrong:

```ts
const first = startTelemetry("lint");
const second = startTelemetry("test");
```

Correct:

```ts
const telemetry = startTelemetry("guard");
```

The second call returns the provider the first one built and its service name is discarded — the spans still export, under the wrong service, and nothing reports the substitution.

Source: masseater/typescript-template:tools/ai-native-telemetry/src/features/ai-native-telemetry/telemetry/telemetry.ts

## Reference

```
MST_TELEMETRY                defined turns measurement on
OTEL_SDK_DISABLED            "true" turns it back off
OTEL_EXPORTER_OTLP_ENDPOINT  where spans, metrics, and log records are sent
```
