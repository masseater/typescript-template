import { tmpdir } from "node:os";
import { env as processEnvironment } from "node:process";

import { assert, it } from "@effect/vitest";
import { deploymentKeys } from "@repo/observability/deployment-keys";
import { Effect, FileSystem } from "effect";

import { verifySecretsFile } from "./credentials.ts";
import { secretsFile } from "./deployment.ts";
import { layer, path } from "./platform.ts";
import { verificationEnvironment } from "./verification-fixture.ts";

import type { Scope } from "effect";

const OWNER_ONLY_FILE_MODE = 0o600;
const GROUP_READABLE_FILE_MODE = 0o640;

const complete = deploymentKeys
  .map((key) => `${key}=${verificationEnvironment[key] ?? "value"}`)
  .join("\n");

function temporaryDirectory(): Effect.Effect<string, never, Scope.Scope> {
  return Effect.gen(function* makeTemporary() {
    const filesystem = yield* FileSystem.FileSystem;
    const directory = yield* filesystem.makeTempDirectoryScoped({
      directory: tmpdir(),
      prefix: "template-secrets-",
    });
    return yield* filesystem.realPath(directory);
  }).pipe(Effect.orDie, Effect.provide(layer));
}

function writeSecrets(filename: string, content: string, mode: number): Effect.Effect<void> {
  return Effect.gen(function* writeOwnerFile() {
    const filesystem = yield* FileSystem.FileSystem;
    yield* filesystem.writeFileString(filename, content);
    yield* filesystem.chmod(filename, mode);
  }).pipe(Effect.orDie, Effect.provide(layer));
}

it.effect("accepts an owner-only file that declares every deployment input", () =>
  Effect.gen(function* program() {
    const directory = yield* temporaryDirectory();
    const filename = path.join(directory, "cloudflare.env");
    yield* writeSecrets(filename, complete, OWNER_ONLY_FILE_MODE);
    const verified = yield* verifySecretsFile(filename);
    assert.strictEqual(verified.filename, filename);
    assert.include(verified.contents, "TEMPLATE_PREFIX=");
  }).pipe(Effect.scoped),
);

it.effect("names the inputs the file is missing", () =>
  Effect.gen(function* program() {
    const directory = yield* temporaryDirectory();
    const filename = path.join(directory, "cloudflare.env");
    yield* writeSecrets(filename, "CLOUDFLARE_API_TOKEN=token\n", OWNER_ONLY_FILE_MODE);
    const failure = yield* verifySecretsFile(filename).pipe(Effect.flip);
    assert.strictEqual(failure.code, "secrets_file_incomplete");
    assert.deepStrictEqual(
      [...failure.keys],
      deploymentKeys.filter((key) => key !== "CLOUDFLARE_API_TOKEN"),
    );
  }).pipe(Effect.scoped),
);

it.effect("refuses a file other accounts can read", () =>
  Effect.gen(function* program() {
    const directory = yield* temporaryDirectory();
    const filename = path.join(directory, "cloudflare.env");
    yield* writeSecrets(filename, complete, GROUP_READABLE_FILE_MODE);
    const failure = yield* verifySecretsFile(filename).pipe(Effect.flip);
    assert.strictEqual(failure.code, "secrets_file_readable_by_others");
  }).pipe(Effect.scoped),
);

it.effect("refuses a file reached through a symbolic link", () =>
  Effect.gen(function* program() {
    const directory = yield* temporaryDirectory();
    const real = path.join(directory, "real.env");
    const link = path.join(directory, "cloudflare.env");
    yield* writeSecrets(real, complete, OWNER_ONLY_FILE_MODE);
    yield* Effect.gen(function* linkFile() {
      const filesystem = yield* FileSystem.FileSystem;
      yield* filesystem.symlink(real, link);
    }).pipe(Effect.orDie, Effect.provide(layer));
    const failure = yield* verifySecretsFile(link).pipe(Effect.flip);
    assert.strictEqual(failure.code, "secrets_file_symlink_forbidden");
  }).pipe(Effect.scoped),
);

it.effect("refuses a directory reached through a symbolic link", () =>
  Effect.gen(function* program() {
    const directory = yield* temporaryDirectory();
    const real = path.join(directory, "real");
    const link = path.join(directory, "linked");
    yield* Effect.gen(function* linkDirectory() {
      const filesystem = yield* FileSystem.FileSystem;
      yield* filesystem.makeDirectory(real);
      yield* filesystem.symlink(real, link);
    }).pipe(Effect.orDie, Effect.provide(layer));
    yield* writeSecrets(path.join(real, "cloudflare.env"), complete, OWNER_ONLY_FILE_MODE);
    const failure = yield* verifySecretsFile(path.join(link, "cloudflare.env")).pipe(Effect.flip);
    assert.strictEqual(failure.code, "secrets_file_symlink_forbidden");
  }).pipe(Effect.scoped),
);

it.effect("reports a missing file instead of deploying without it", () =>
  Effect.gen(function* program() {
    const directory = yield* temporaryDirectory();
    const failure = yield* verifySecretsFile(path.join(directory, "cloudflare.env")).pipe(
      Effect.flip,
    );
    assert.strictEqual(failure.code, "secrets_file_missing");
  }).pipe(Effect.scoped),
);

it.effect("resolves the same file the staged-diff check reads", () =>
  Effect.acquireUseRelease(
    Effect.sync(() => processEnvironment["TEMPLATE_CLOUDFLARE_ENV_FILE"]),
    () =>
      Effect.sync(() => {
        delete processEnvironment["TEMPLATE_CLOUDFLARE_ENV_FILE"];
        assert.match(secretsFile("template"), /\/\.config\/template\/cloudflare\.env$/u);
        processEnvironment["TEMPLATE_CLOUDFLARE_ENV_FILE"] = "/elsewhere/cloudflare.env";
        assert.strictEqual(secretsFile("template"), "/elsewhere/cloudflare.env");
      }),
    (previous) =>
      Effect.sync(() => {
        delete processEnvironment["TEMPLATE_CLOUDFLARE_ENV_FILE"];
        Object.assign(
          processEnvironment,
          previous === undefined ? {} : { TEMPLATE_CLOUDFLARE_ENV_FILE: previous },
        );
      }),
  ),
);
