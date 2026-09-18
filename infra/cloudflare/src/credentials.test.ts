// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import type { Scope } from "effect";

import { deploymentKeys, secretsFile } from "@repo/config/deployment";

import { verifySecretsFile } from "./credentials.ts";
import { verificationEnvironment } from "./verification-fixture.ts";

const OWNER_ONLY_FILE_MODE = 0o600;
const GROUP_READABLE_FILE_MODE = 0o640;

const complete = deploymentKeys
  .map((key) => `${key}=${verificationEnvironment[key] ?? "value"}`)
  .join("\n");
const temporaryPrefix = path.join(tmpdir(), "template-secrets-");

function temporaryDirectory(): Effect.Effect<string, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.promise(async () => mkdtemp(temporaryPrefix)),
    (directory) => Effect.promise(async () => rm(directory, { force: true, recursive: true })),
  );
}

function writeSecrets(filename: string, content: string, mode: number): Effect.Effect<void> {
  return Effect.promise(async () => {
    await writeFile(filename, content);
    await chmod(filename, mode);
  });
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
    yield* Effect.promise(async () => symlink(real, link));
    const failure = yield* verifySecretsFile(link).pipe(Effect.flip);
    assert.strictEqual(failure.code, "secrets_file_symlink_forbidden");
  }).pipe(Effect.scoped),
);

it.effect("refuses a directory reached through a symbolic link", () =>
  Effect.gen(function* program() {
    const directory = yield* temporaryDirectory();
    const real = path.join(directory, "real");
    const link = path.join(directory, "linked");
    yield* Effect.promise(async () => mkdir(real));
    yield* writeSecrets(path.join(real, "cloudflare.env"), complete, OWNER_ONLY_FILE_MODE);
    yield* Effect.promise(async () => symlink(real, link));
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
    // oxlint-disable-next-line node/no-process-env
    Effect.sync(() => process.env["TEMPLATE_CLOUDFLARE_ENV_FILE"]),
    () =>
      Effect.sync(() => {
        // oxlint-disable-next-line node/no-process-env
        delete process.env["TEMPLATE_CLOUDFLARE_ENV_FILE"];
        assert.match(secretsFile("template"), /\/\.config\/template\/cloudflare\.env$/u);
        // oxlint-disable-next-line node/no-process-env
        process.env["TEMPLATE_CLOUDFLARE_ENV_FILE"] = "/elsewhere/cloudflare.env";
        assert.strictEqual(secretsFile("template"), "/elsewhere/cloudflare.env");
      }),
    (previous) =>
      Effect.sync(() => {
        // oxlint-disable-next-line node/no-process-env
        const environment = process.env;
        delete environment["TEMPLATE_CLOUDFLARE_ENV_FILE"];
        Object.assign(
          environment,
          previous === undefined ? {} : { TEMPLATE_CLOUDFLARE_ENV_FILE: previous },
        );
      }),
  ),
);
