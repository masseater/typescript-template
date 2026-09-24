#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node";
import fsd from "@feature-sliced/steiger-plugin";
import { causeRecord, markFailed, runCli } from "@repo/cli";
import { Console, Effect, Path } from "effect";
import { linter, processConfiguration } from "steiger";

type Diagnostic = Awaited<ReturnType<typeof linter.run>>[number];

const locationOf = (diagnostic: Diagnostic, relative: (path: string) => string): string =>
  [
    relative(diagnostic.location.path).replaceAll("\\", "/"),
    diagnostic.location.line,
    diagnostic.location.column,
  ]
    .filter((part) => part !== undefined)
    .join(":");

const program = Effect.gen(function* main() {
  const paths = yield* Path.Path;
  const target = paths.resolve(process.cwd(), process.argv[2] ?? "src");
  yield* Effect.sync(() => processConfiguration(fsd.configs.recommended, null));
  const diagnostics = yield* Effect.tryPromise(() => linter.run(target));
  if (diagnostics.length > 0) {
    const relative = (path: string): string => paths.relative(process.cwd(), path) || ".";
    yield* Console.error(
      diagnostics
        .map(
          (diagnostic) =>
            `${locationOf(diagnostic, relative)}: ${diagnostic.severity} ${diagnostic.ruleName}: ${diagnostic.message} (${diagnostic.getRuleDescriptionUrl(diagnostic.ruleName).href})`,
        )
        .join("\n"),
    );
    return yield* markFailed;
  }
  yield* Console.log(`feature-sliced: ok (${paths.relative(process.cwd(), target) || "."})`);
});

runCli(program.pipe(Effect.provide(NodeServices.layer)), (cause) =>
  causeRecord("quality.feature_sliced_failed", { cause }),
);
