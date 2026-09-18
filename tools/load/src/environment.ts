import { Effect, Schema } from "effect";
import { applicationPorts, applications } from "@template/config";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { randomBytes } from "node:crypto";

class EnvironmentUnusable extends Schema.TaggedError<EnvironmentUnusable>()("EnvironmentUnusable", {
  reason: Schema.Literals(["file_io_failed", "origin_mismatch"]),
}) {}

const Application = Schema.Literals(applications);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const appOrigin = /^APP_ORIGIN="(?<origin>[^"]*)"$/mu;
const secretBytes = 48;
const ownerOnlyFile = 0o600;

function targetOrigin(app: typeof Application.Type): string {
  return `http://127.0.0.1:${applicationPorts[app]}`;
}

function variablesFile(app: typeof Application.Type): string {
  return path.join(root, "apps", app, ".dev.vars");
}

function declaredOrigin(app: typeof Application.Type): Effect.Effect<string | undefined> {
  return Effect.promise(async () => readFile(variablesFile(app), "utf-8")).pipe(
    Effect.map((content) => appOrigin.exec(content)?.groups?.["origin"]),
    Effect.orElseSucceed((): string | undefined => undefined),
  );
}

const requireLoopbackOrigin = Effect.fn("requireLoopbackOrigin")(function* requireLoopbackOrigin(
  app: typeof Application.Type,
) {
  const origin = targetOrigin(app);
  if ((yield* declaredOrigin(app)) !== origin) {
    return yield* new EnvironmentUnusable({ reason: "origin_mismatch" });
  }
  return origin;
});

const writeLoopbackVariables = Effect.fn("writeLoopbackVariables")(function* writeLoopbackVariables(
  app: typeof Application.Type,
) {
  const declared = yield* declaredOrigin(app);
  if (declared !== undefined && declared !== targetOrigin(app)) {
    return yield* new EnvironmentUnusable({ reason: "origin_mismatch" });
  }
  const variables = {
    APP_ORIGIN: targetOrigin(app),
    AUTH_SECRET: randomBytes(secretBytes).toString("base64url"),
    EMAIL_FROM: "no-reply@example.test",
    MAILPIT_URL: "http://127.0.0.1:8025",
  };
  const content = Object.entries(variables)
    .map(([key, value]: readonly [string, string]) => `${key}=${JSON.stringify(value)}`)
    .join("\n");
  if (declared === undefined) {
    yield* Effect.tryPromise({
      catch: () => new EnvironmentUnusable({ reason: "file_io_failed" }),
      try: async () => writeFile(variablesFile(app), `${content}\n`, { mode: ownerOnlyFile }),
    });
  }
  return targetOrigin(app);
});

export {
  Application,
  EnvironmentUnusable,
  requireLoopbackOrigin,
  targetOrigin,
  writeLoopbackVariables,
};
