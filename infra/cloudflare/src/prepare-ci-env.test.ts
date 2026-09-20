// oxlint-disable-next-line import/no-nodejs-modules
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { assert, it } from "@effect/vitest";
import { deploymentKeys } from "@repo/observability/deployment-keys";
import { Effect } from "effect";

import { writeCiSecretsFile } from "./ci-env.ts";
import { verificationEnvironment } from "./verification-fixture.ts";

import type { Scope } from "effect";

const temporaryPrefix = path.join(tmpdir(), "template-ci-env-");

function temporaryDirectory(): Effect.Effect<string, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.promise(async () => mkdtemp(temporaryPrefix)),
    (directory) => Effect.promise(async () => rm(directory, { force: true, recursive: true })),
  );
}

it.effect("writes an owner-only env file from required deployment keys", () =>
  Effect.gen(function* program() {
    const directory = yield* temporaryDirectory();
    const runnerTemp = path.join(directory, "runner");
    const githubEnv = path.join(directory, "github.env");
    yield* Effect.promise(async () => writeFile(githubEnv, ""));
    const required = Object.fromEntries(
      deploymentKeys.map((key) => [key, verificationEnvironment[key] ?? "value"] as const),
    );
    const preparation = yield* writeCiSecretsFile({
      ...required,
      GITHUB_ENV: githubEnv,
      RUNNER_TEMP: runnerTemp,
    });
    assert.strictEqual(preparation.status, "ready");
    if (preparation.status !== "ready") {
      return;
    }
    const contents = yield* Effect.promise(async () => readFile(preparation.filename, "utf-8"));
    assert.include(contents, "TEMPLATE_PREFIX=");
    const pointer = yield* Effect.promise(async () => readFile(githubEnv, "utf-8"));
    assert.include(pointer, `TEMPLATE_CLOUDFLARE_ENV_FILE=${preparation.filename}`);
  }).pipe(Effect.scoped),
);

it.effect("reports unconfigured when every deployment key is absent", () =>
  Effect.gen(function* program() {
    const directory = yield* temporaryDirectory();
    const preparation = yield* writeCiSecretsFile({
      RUNNER_TEMP: path.join(directory, "runner"),
    });
    assert.strictEqual(preparation.status, "unconfigured");
  }).pipe(Effect.scoped),
);

it.effect("refuses when a required deployment key is missing", () =>
  Effect.gen(function* program() {
    const directory = yield* temporaryDirectory();
    const required = Object.fromEntries(
      deploymentKeys
        .filter((key) => key !== "CLOUDFLARE_API_TOKEN")
        .map((key) => [key, verificationEnvironment[key] ?? "value"] as const),
    );
    const failure = yield* writeCiSecretsFile({
      ...required,
      RUNNER_TEMP: path.join(directory, "runner"),
    }).pipe(Effect.flip);
    assert.strictEqual(failure.code, "ci_env_incomplete");
    assert.deepStrictEqual([...failure.keys], ["CLOUDFLARE_API_TOKEN"]);
  }).pipe(Effect.scoped),
);

it.effect("refuses retired per-app origin secrets when TEMPLATE_APP_DOMAIN is absent", () =>
  Effect.gen(function* program() {
    const directory = yield* temporaryDirectory();
    const required = Object.fromEntries(
      deploymentKeys
        .filter((key) => key !== "TEMPLATE_APP_DOMAIN")
        .map((key) => [key, verificationEnvironment[key] ?? "value"] as const),
    );
    const failure = yield* writeCiSecretsFile({
      ...required,
      RUNNER_TEMP: path.join(directory, "runner"),
      TEMPLATE_INTERNAL_DASHBOARD_ORIGIN: "https://template-verify-dashboard.example.com",
      TEMPLATE_SERVICE_ADMIN_ORIGIN: "https://template-verify-admin.example.com",
      TEMPLATE_SERVICE_MEMBER_ORIGIN: "https://template-verify-member.example.com",
    }).pipe(Effect.flip);
    assert.strictEqual(failure.code, "ci_env_retired_origins");
    assert.deepStrictEqual(
      [...failure.keys],
      [
        "TEMPLATE_APP_DOMAIN",
        "TEMPLATE_SERVICE_MEMBER_ORIGIN",
        "TEMPLATE_SERVICE_ADMIN_ORIGIN",
        "TEMPLATE_INTERNAL_DASHBOARD_ORIGIN",
      ],
    );
  }).pipe(Effect.scoped),
);

it.effect("refuses retired per-app origin secrets even when TEMPLATE_APP_DOMAIN is set", () =>
  Effect.gen(function* program() {
    const directory = yield* temporaryDirectory();
    const required = Object.fromEntries(
      deploymentKeys.map((key) => [key, verificationEnvironment[key] ?? "value"] as const),
    );
    const failure = yield* writeCiSecretsFile({
      ...required,
      RUNNER_TEMP: path.join(directory, "runner"),
      TEMPLATE_SERVICE_MEMBER_ORIGIN: "https://template-verify-member.example.com",
    }).pipe(Effect.flip);
    assert.strictEqual(failure.code, "ci_env_retired_origins");
    assert.deepStrictEqual([...failure.keys], ["TEMPLATE_SERVICE_MEMBER_ORIGIN"]);
  }).pipe(Effect.scoped),
);
