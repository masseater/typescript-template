import * as pulumi from "@pulumi/pulumi";
import { Effect, Schema } from "effect";
import { CloudflareFailure, parseSharedConfig, validateAuthSecret } from "./config.ts";
import { projectName, stackReferenceName } from "./stacks.ts";
import type { DependencyOf, StackName, StackOutputs } from "./stacks.ts";

const OutputText = Schema.String.check(Schema.isMinLength(1));

export const consume = <C extends StackName, S extends DependencyOf<C> & keyof StackOutputs>(
  consumer: C,
  source: S,
) =>
  Effect.gen(function* () {
    if (pulumi.getProject() !== projectName(consumer))
      return yield* new CloudflareFailure({ code: "stack_consumer_mismatch" });
    const reference = new pulumi.StackReference(stackReferenceName(source, pulumi.getStack()));
    return {
      details: (name: StackOutputs[S]) =>
        Effect.tryPromise({
          try: () => reference.getOutputDetails(name),
          catch: () => new CloudflareFailure({ code: "stack_output_invalid" }),
        }),
      text: (name: StackOutputs[S]) =>
        reference
          .requireOutput(name)
          .apply((value: unknown) =>
            Effect.runSync(
              Schema.decodeUnknownEffect(OutputText)(value).pipe(
                Effect.mapError(() => new CloudflareFailure({ code: "stack_output_invalid" })),
              ),
            ),
          ),
    };
  });

export const consumeSettings = <C extends StackName>(
  consumer: C,
  source: DependencyOf<C> & "settings",
) =>
  Effect.gen(function* () {
    const reference = yield* consume(consumer, source);
    const details = yield* reference.details("applicationSettings");
    return {
      settings: yield* parseSharedConfig(details.value),
      authSecret: pulumi.secret(
        reference
          .text("authSecret")
          .apply((value: unknown) => Effect.runSync(validateAuthSecret(value))),
      ),
    };
  });
