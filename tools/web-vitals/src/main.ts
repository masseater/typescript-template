import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Array, Console, Effect, FileSystem, Layer, Path, Schema, String, pipe } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { FetchHttpClient } from "effect/http";
import { OtlpSerialization, OtlpTracer } from "effect/observability";

import { measureFlow } from "./flow.ts";
import { summarize } from "./metrics.ts";

const REPORT_DIRECTORY = "report";
const MINIMUM_URLS = 1;

const taggedError = Schema.TaggedError;

class PoorVitals extends taggedError<PoorVitals, { readonly brand: unique symbol }>()(
  "PoorVitals",
  { failures: Schema.Array(Schema.String) },
) {}

const tracing = OtlpTracer.layerFromConfig({
  resource: { serviceName: "web-vitals" },
}).pipe(Layer.provide(OtlpSerialization.layerJson), Layer.provide(FetchHttpClient.layer));

const services = Layer.mergeAll(tracing, NodeServices.layer);

const encodeJson = Schema.encodeUnknownEffect(Schema.fromJsonString(Schema.Unknown));

const command = Command.make(
  "web-vitals",
  {
    urls: Argument.String("url").pipe(Argument.atLeast(MINIMUM_URLS)),
    chromeFlags: Flag.String("chrome-flags").pipe(Flag.withDefault("")),
  },
  ({ urls, chromeFlags }) =>
    Effect.gen(function* measure() {
      const flags = pipe(chromeFlags, String.split(" "), Array.filter(Boolean));
      const { result, html } = yield* measureFlow(urls, flags);
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* fileSystem.makeDirectory(REPORT_DIRECTORY, { recursive: true });
      yield* fileSystem.writeFileString(path.join(REPORT_DIRECTORY, "flow.html"), html);
      yield* fileSystem.writeFileString(
        path.join(REPORT_DIRECTORY, "flow.json"),
        yield* encodeJson(result),
      );
      const { table, failures } = summarize(result);
      yield* Console.log(table);
      return yield* Array.match(failures, {
        onEmpty: () => Effect.void,
        onNonEmpty: (poor) => Effect.fail(PoorVitals.make({ failures: poor })),
      });
    }),
);

NodeRuntime.runMain(
  Layer.build(services).pipe(
    Effect.flatMap((context) =>
      Effect.provideContext(Command.run(command, { version: "0.0.0" }), context),
    ),
    Effect.scoped,
  ),
);
