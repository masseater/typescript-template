import { Stack } from "alchemy";
import { Rules } from "alchemy/Cloudflare";
import { Array as Arr, Effect, Match, Option, Schema } from "effect";

const APP_NAME = "typescript-template";

const PREFIX = `${APP_NAME}-`;

const LIST_PREFIX = `${APP_NAME.replaceAll("-", "_")}_`;

const CI_TELEMETRY_AUDIENCE = `${PREFIX}ci-telemetry`;

const decodeNamed = Schema.decodeUnknownOption(Schema.Struct({ name: Schema.String }));

const prefixOf = (resource: unknown): string =>
  Match.value(resource).pipe(
    Match.when(Rules.isList, () => LIST_PREFIX),
    Match.orElse(() => PREFIX),
  );

const describeUnprefixed = (
  resource: Readonly<{ FQN: string; Props: unknown }>,
): readonly string[] =>
  decodeNamed(resource.Props).pipe(
    Option.filter(({ name }) => !name.startsWith(prefixOf(resource))),
    Option.map(({ name }) => `${resource.FQN}: ${name}`),
    Option.toArray,
  );

const requireAppPrefix = Effect.gen(function* requireAppPrefix() {
  const { name, resources } = yield* Stack;
  const offenders = [
    ...Arr.filter([`Stack: ${name}`], () => name !== APP_NAME),
    ...Object.values(resources).flatMap((resource) => describeUnprefixed(resource)),
  ];
  if (Arr.isReadonlyArrayNonEmpty(offenders)) {
    return yield* Effect.die(
      new Error(
        `Alchemy のスタック名は "${APP_NAME}"、リソース名は "${PREFIX}"（Rules.List は "${LIST_PREFIX}"）で始める: ${offenders.join(", ")}`,
      ),
    );
  }
  return offenders;
});

export { APP_NAME, CI_TELEMETRY_AUDIENCE, requireAppPrefix };
