import { Stack, Stage } from "alchemy";
import { Config, Effect, Schema } from "effect";

import { deploymentPrefix } from "./settings.ts";
import { stackName, stackOptions, stackProviders } from "./stacks.ts";

import type { CompiledStack, ProviderServices, StackServices } from "alchemy";
import type { Layer } from "effect";
import type { StackName } from "./stacks.ts";

const prefixStage = (prefix: string): Schema.Codec<string> =>
  Schema.String.check(
    Schema.makeFilter(
      (stage: string) =>
        stage === prefix ||
        `stage "${stage}" is not the deployment prefix "${prefix}"; run alchemy with --stage ${prefix}`,
    ),
  );

const stagedAs = <A, Req>(
  prefix: string,
  program: Effect.Effect<A, Config.ConfigError, Req>,
): Effect.Effect<A, Config.ConfigError, Req | Stage> =>
  Effect.gen(function* stagedProgram() {
    const stage = yield* Stage;
    yield* Schema.decodeEffect(prefixStage(prefix))(stage).pipe(
      Effect.mapError((mismatch) => new Config.ConfigError(mismatch)),
    );
    return yield* program;
  });

const stagedAtDeploymentPrefix = <A, Req>(
  program: Effect.Effect<A, Config.ConfigError, Req>,
): Effect.Effect<A, Config.ConfigError, Req | Stage> =>
  Effect.gen(function* stagedAtPrefix() {
    return yield* stagedAs(yield* deploymentPrefix, program);
  });

const prefixedStack = <A>(
  stack: StackName,
  program: Effect.Effect<
    A,
    Config.ConfigError,
    StackServices | Extract<Layer.Success<typeof stackProviders>, ProviderServices>
  >,
): Effect.Effect<CompiledStack<A>, Config.ConfigError> =>
  Stack(stackName(stack), stackOptions, stagedAtDeploymentPrefix(program));

export { prefixedStack, stagedAs };
