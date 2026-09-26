import { context, propagation, type Context, type TextMapGetter } from "@opentelemetry/api";
import { EnvironmentSetter } from "@opentelemetry/propagator-env-carrier";
import { inheritedEnvironment } from "@repo/config/process-environment";

type Environment = ReturnType<typeof inheritedEnvironment>;

const environmentGetter: TextMapGetter<Environment> = {
  get: (carrier, field) => carrier[field.toUpperCase().replaceAll(/[^A-Z0-9_]/gu, "_")],
  keys: Object.keys,
};

const inheritedContext = (environment: Environment = inheritedEnvironment()): Context =>
  propagation.extract(context.active(), environment, environmentGetter);

const environmentCarryingContext = (
  environment: Environment = inheritedEnvironment(),
): Record<string, string> => {
  const carrier = { ...environment };
  propagation.inject(context.active(), undefined, new EnvironmentSetter(carrier));
  return carrier;
};

export { environmentCarryingContext, inheritedContext };
export type { Environment };
