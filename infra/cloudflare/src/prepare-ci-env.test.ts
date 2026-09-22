import { tmpdir } from "node:os";

import { assert, it } from "@effect/vitest";
import {
  budgetKeys,
  deploymentKeys,
  optionalDeploymentKeys,
} from "@repo/observability/deployment-keys";
import { Effect, FileSystem } from "effect";

import { writeCiSecretsFile } from "./ci-env.ts";
import { layer, path } from "./platform.ts";
import { verificationEnvironment } from "./verification-fixture.ts";

import type { Scope } from "effect";

function temporaryDirectory(): Effect.Effect<string, never, Scope.Scope> {
  return Effect.gen(function* makeTemporary() {
    const filesystem = yield* FileSystem.FileSystem;
    const directory = yield* filesystem.makeTempDirectoryScoped({
      directory: tmpdir(),
      prefix: "template-ci-env-",
    });
    return yield* filesystem.realPath(directory);
  }).pipe(Effect.orDie, Effect.provide(layer));
}

it.effect("writes an owner-only env file from required deployment keys", () =>
  Effect.gen(function* program() {
    const directory = yield* temporaryDirectory();
    const runnerTemp = path.join(directory, "runner");
    const githubEnv = path.join(directory, "github.env");
    yield* Effect.gen(function* seedGithubEnv() {
      const filesystem = yield* FileSystem.FileSystem;
      yield* filesystem.writeFileString(githubEnv, "");
    }).pipe(Effect.orDie, Effect.provide(layer));
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
    const contents = yield* Effect.gen(function* readContents() {
      const filesystem = yield* FileSystem.FileSystem;
      return yield* filesystem.readFileString(preparation.filename);
    }).pipe(Effect.orDie, Effect.provide(layer));
    assert.include(contents, "TEMPLATE_PREFIX=");
    const pointer = yield* Effect.gen(function* readPointer() {
      const filesystem = yield* FileSystem.FileSystem;
      return yield* filesystem.readFileString(githubEnv);
    }).pipe(Effect.orDie, Effect.provide(layer));
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

it.effect("carries optional budget amounts and drops the ones left empty", () =>
  Effect.gen(function* program() {
    const directory = yield* temporaryDirectory();
    const required = Object.fromEntries(
      deploymentKeys.map((key) => [key, verificationEnvironment[key] ?? "value"] as const),
    );
    const carried = budgetKeys.filter(
      (key) => !deploymentKeys.some((requiredKey) => requiredKey === key),
    );
    const [kept, dropped] = [carried[0], carried[1]];
    if (kept === undefined || dropped === undefined) {
      return yield* Effect.die("budget keys to carry");
    }
    const preparation = yield* writeCiSecretsFile({
      ...required,
      [kept]: verificationEnvironment[kept] ?? "1",
      RUNNER_TEMP: path.join(directory, "runner"),
    });
    assert.strictEqual(preparation.status, "ready");
    if (preparation.status !== "ready") {
      return;
    }
    const contents = yield* Effect.gen(function* readContents() {
      const filesystem = yield* FileSystem.FileSystem;
      return yield* filesystem.readFileString(preparation.filename);
    }).pipe(Effect.orDie, Effect.provide(layer));
    assert.include(contents, `${kept}=`);
    assert.notInclude(contents, `${dropped}=`);
    for (const key of optionalDeploymentKeys) {
      assert.notInclude(contents, `${key}=`);
    }
  }).pipe(Effect.scoped),
);
