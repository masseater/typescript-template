import type { DependencyOf, StackName, StackOutputs } from "./stacks.ts";
import type { Output, StackReferenceOutputDetails } from "@pulumi/pulumi";
import { StackReference, getProject, getStack, secret } from "@pulumi/pulumi";
import { parseSharedConfig, validateAuthSecret } from "./config.ts";
import { projectName, stackReferenceName } from "./stacks.ts";
import type { SharedConfig } from "./config.ts";

interface StackConsumer<Name extends string> {
  readonly details: (name: Name) => Promise<StackReferenceOutputDetails>;
  readonly text: (name: Name) => Output<string>;
}

interface ConsumedSettings {
  readonly authSecret: Output<string>;
  readonly settings: SharedConfig;
}

function requireText(name: string): (value: unknown) => string {
  return (value) => {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`stack_output_invalid:${name}`);
    }
    return value;
  };
}

function consume<
  Consumer extends StackName,
  Source extends DependencyOf<Consumer> & keyof StackOutputs,
>(consumer: Consumer, source: Source): StackConsumer<StackOutputs[Source]> {
  if (getProject() !== projectName(consumer)) {
    throw new Error("stack_consumer_mismatch");
  }
  const reference = new StackReference(stackReferenceName(source, getStack()));
  return {
    details: async (name) => reference.getOutputDetails(name),
    text: (name) => reference.requireOutput(name).apply(requireText(name)),
  };
}

async function consumeSettings<Consumer extends StackName>(
  consumer: Consumer,
  source: Extract<DependencyOf<Consumer>, "settings">,
): Promise<ConsumedSettings> {
  const reference = consume(consumer, source);
  const details = await reference.details("applicationSettings");
  return {
    authSecret: secret(reference.text("authSecret").apply(validateAuthSecret)),
    settings: parseSharedConfig(details.value),
  };
}

export { consume, consumeSettings };
