import { NodeServices } from "@effect/platform-node";
import { appEnvKey, type Application, grants } from "@repo/config";
import { Crypto, Effect, FileSystem, Path } from "effect";

import { failed, type JourneyFailure } from "./journey-failure.ts";
import { applicationRoot } from "./repository.ts";

import type { Disposer } from "./disposers.ts";

const secretBytes = 48;

const generateAuthSecret = (): Effect.Effect<string, never, Crypto.Crypto> =>
  Effect.gen(function* createAuthSecret() {
    const crypto = yield* Crypto.Crypto;
    const secret = yield* crypto.randomBytes(secretBytes).pipe(Effect.orDie);
    return Buffer.from(secret).toString("base64url");
  });

const presentContent = (
  file: string,
): Effect.Effect<readonly string[], JourneyFailure, FileSystem.FileSystem> =>
  Effect.gen(function* readPresentContent() {
    const filesystem = yield* FileSystem.FileSystem;
    return yield* filesystem.readFileString(file).pipe(
      Effect.map((recordedText) => [recordedText]),
      Effect.catchIf(
        (cause) => cause.reason._tag === "NotFound",
        () => Effect.succeed([]),
      ),
      Effect.mapError((cause) => failed("E2E_DEV_VARS_UNREADABLE", cause)),
    );
  });

type DevVars = {
  readonly appOrigin: string;
  readonly authSecret: string;
  readonly mailOrigin: string;
};

const stripeTestPlaceholders: readonly (readonly [string, string])[] = [
  ["STRIPE_PRICE_ID", "price_e2ePlaceholderNotReal"],
  ["STRIPE_SECRET_KEY", "sk_test_e2ePlaceholderNotAReal"],
  ["STRIPE_WEBHOOK_SECRET", "whsec_e2ePlaceholderNotReal"],
];

const serialize = (application: Application, devVars: DevVars): string => {
  const assignments: readonly (readonly [string, string])[] = [
    [appEnvKey.appOrigin, devVars.appOrigin],
    [appEnvKey.authSecret, devVars.authSecret],
    [appEnvKey.emailFrom, "no-reply@example.test"],
    [appEnvKey.mailpitUrl, devVars.mailOrigin],
    [appEnvKey.opsEmail, "ops@example.test"],
    ...(grants(application, "billing") ? stripeTestPlaceholders : []),
  ];
  return `${assignments.map(([variable, assigned]) => `${variable}=${JSON.stringify(assigned)}`).join("\n")}\n`;
};

const fileMode = 0o600;

const restoreDevVars = (
  file: string,
  replaced: string | undefined,
): Effect.Effect<void, JourneyFailure> =>
  Effect.gen(function* restoreReplacedDevVars() {
    const filesystem = yield* FileSystem.FileSystem;
    const restored =
      replaced === undefined
        ? filesystem.remove(file, { force: true })
        : filesystem.writeFileString(file, replaced, { mode: fileMode });
    yield* restored.pipe(Effect.mapError((cause) => failed("E2E_DEV_VARS_RESTORE_FAILED", cause)));
  }).pipe(Effect.provide(NodeServices.layer));

const replaceDevVars = (
  application: Application,
  devVars: DevVars,
): Effect.Effect<Disposer, JourneyFailure, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* writeDevVars() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const file = paths.join(applicationRoot(application), ".dev.vars");
    const [replaced] = yield* presentContent(file);
    yield* filesystem
      .writeFileString(file, serialize(application, devVars), { mode: fileMode })
      .pipe(Effect.mapError((cause) => failed("E2E_DEV_VARS_UNWRITABLE", cause)));
    return yield* Effect.succeed(restoreDevVars(file, replaced));
  });

export { generateAuthSecret, replaceDevVars };
