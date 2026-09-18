import { NodeServices } from "@effect/platform-node";
import { Layer } from "effect";

import { routes } from "#shared/telemetry/index.ts";
import { Telemetry } from "@repo/observability";
import type { Reporting, TelemetryFlusher, TelemetryInvalid } from "@repo/observability";
import { AppOrigin } from "@repo/runtime/http";

import type { BdFailure } from "./bd.ts";
import type { ChatFailure } from "./chat-failure.ts";
import type { Services } from "./commander-api.ts";
import { commanderLayer } from "./commander.ts";
import type { CommanderOptions } from "./commander.ts";
import type { PromptFailure } from "./prompt.ts";

const service = "commander";
const reporting: Reporting = { service };

function commanderServices(
  options: CommanderOptions & { readonly origin: string },
): Layer.Layer<
  Services | TelemetryFlusher,
  BdFailure | ChatFailure | PromptFailure | TelemetryInvalid
> {
  return Layer.mergeAll(
    Layer.succeed(AppOrigin, options.origin),
    commanderLayer(options).pipe(Layer.provideMerge(NodeServices.layer)),
    Telemetry.layer({ release: "local", routes, serviceName: service }),
  );
}

export { commanderServices, reporting };
