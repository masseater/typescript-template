import * as pulumi from "@pulumi/pulumi";
import { parseSharedConfig, validateAuthSecret } from "./config.ts";
import { projectName, stackReferenceName } from "./stacks.ts";
import type { DependencyOf, StackName, StackOutputs } from "./stacks.ts";

export function consume<C extends StackName, S extends DependencyOf<C> & keyof StackOutputs>(
  consumer: C,
  source: S,
) {
  if (pulumi.getProject() !== projectName(consumer)) throw new Error("stack_consumer_mismatch");
  const reference = new pulumi.StackReference(stackReferenceName(source, pulumi.getStack()));
  return {
    details: (name: StackOutputs[S]) => reference.getOutputDetails(name),
    text: (name: StackOutputs[S]) =>
      reference.requireOutput(name).apply((value: unknown) => {
        if (typeof value !== "string" || value.length === 0)
          throw new Error(`stack_output_invalid:${name}`);
        return value;
      }),
  };
}

export async function consumeSettings<C extends StackName>(
  consumer: C,
  source: DependencyOf<C> & "settings",
) {
  const reference = consume(consumer, source);
  const details = await reference.details("applicationSettings");
  return {
    settings: parseSharedConfig(details.value),
    authSecret: pulumi.secret(reference.text("authSecret").apply(validateAuthSecret)),
  };
}
