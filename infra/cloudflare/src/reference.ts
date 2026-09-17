import { CloudflareFailure, parseSharedConfig, validateAuthSecret } from "./config.ts";
import type { DependencyOf, StackName, StackOutputs } from "./stacks.ts";
import { Effect, Schema } from "effect";
import type { Output, StackReferenceOutputDetails } from "@pulumi/pulumi";
import { StackReference, getProject, getStack, secret } from "@pulumi/pulumi";
import { projectName, stackReferenceName } from "./stacks.ts";

interface StackConsumer<Name extends string> {
  readonly details: (name: Name) => Effect.Effect<StackReferenceOutputDetails, CloudflareFailure>;
  readonly text: (name: Name) => Output<string>;
}

const OutputText = Schema.String.check(Schema.isMinLength(1));

async function requireText(value: unknown): Promise<string> {
  return Effect.runPromise(
    Schema.decodeUnknownEffect(OutputText)(value).pipe(
      Effect.mapError(() => new CloudflareFailure({ code: "stack_output_invalid" })),
    ),
  );
}

function consume<
  Consumer extends StackName,
  Source extends DependencyOf<Consumer> & keyof StackOutputs,
>(
  consumer: Consumer,
  source: Source,
): Effect.Effect<StackConsumer<StackOutputs[Source]>, CloudflareFailure> {
  if (getProject() !== projectName(consumer)) {
    return Effect.fail(new CloudflareFailure({ code: "stack_consumer_mismatch" }));
  }
  const reference = new StackReference(stackReferenceName(source, getStack()));
  return Effect.succeed({
    details: (name) =>
      Effect.tryPromise({
        catch: () => new CloudflareFailure({ code: "stack_output_invalid" }),
        try: async () => reference.getOutputDetails(name),
      }),
    text: (name) => reference.requireOutput(name).apply(requireText),
  });
}

const consumeSettings = Effect.fn("consumeSettings")(function* consumeSettings<
  Consumer extends StackName,
>(consumer: Consumer, source: Extract<DependencyOf<Consumer>, "settings">) {
  const reference = yield* consume(consumer, source);
  const details = yield* reference.details("applicationSettings");
  return {
    authSecret: secret(
      reference
        .text("authSecret")
        .apply(async (value: unknown) => Effect.runPromise(validateAuthSecret(value))),
    ),
    settings: yield* parseSharedConfig(details.value),
  };
});

export { consume, consumeSettings };
