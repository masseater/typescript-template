import type { Ai, D1Database, SendEmail, Service } from "@cloudflare/workers-types";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { ConfigurationInvalid, readAi, readConfig } from "@template/config";

import type { AppBindings } from "./bindings.ts";
import { parseDeploymentCommand } from "./config.ts";
import { stackNames } from "./stacks.ts";
import { verificationSettings } from "./verification-fixture.ts";

const release = "0123456789abcdef";
const settings = verificationSettings;

// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
function binding<Binding>(value: object): Binding {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return value as Binding;
}

const sharedBindings = {
  APP_ORIGIN: settings.origins.admin,
  APP_RELEASE: release,
  ASSETS: binding<Service>({ fetch: async (): Promise<Response> => new Response() }),
  AUTH_SECRET: "runtime-secret-of-at-least-32-characters",
  DB: binding<D1Database>({
    batch: async (): Promise<never[]> => [],
    prepare: (): undefined => undefined,
  }),
  EMAIL: binding<SendEmail>({ send: async (): Promise<undefined> => undefined }),
  EMAIL_FROM: settings.mailFrom,
};

const adminBindings: AppBindings<"admin"> = sharedBindings;
const userBindings: AppBindings<"user"> = {
  ...sharedBindings,
  AI: binding<Ai>({ run: async (): Promise<{ data: never[] }> => ({ data: [] }) }),
  APP_ORIGIN: settings.origins.user,
};

const confirmation = "0123456789abcdef";

it.effect(
  "deployment commands reject ignored arguments instead of selecting an unintended stack",
  () =>
    Effect.gen(function* program() {
      assert.deepStrictEqual(yield* parseDeploymentCommand(["plan", "admin"]), {
        operation: "plan",
        stacks: ["admin"],
      });
      assert.deepStrictEqual(yield* parseDeploymentCommand(["plan", "all"]), {
        operation: "plan",
        stacks: [...stackNames],
      });
      assert.deepStrictEqual(
        yield* parseDeploymentCommand(["deploy", "user", "--confirm-plan", confirmation]),
        { confirmation, operation: "deploy", stack: "user" },
      );
      for (const args of [
        ["deploy", "user"],
        ["deploy", "all", "--confirm-plan", confirmation],
        ["deploy", "user", "--confirm-plan", confirmation, "--stage", "other"],
        ["deploy", "user", "--confirm-plan", "not-a-confirmation"],
        ["deploy", "user", "--yes"],
        ["deploy", "unknown", "--confirm-plan", confirmation],
        ["plan", "all", "--confirm-plan", confirmation],
        ["up", "all"],
      ]) {
        const failure = yield* parseDeploymentCommand(args).pipe(Effect.flip);
        assert.strictEqual(failure.code, "deployment_command_invalid");
      }
    }),
);

it.effect("every application reads exactly the bindings its Worker declares", () =>
  Effect.gen(function* program() {
    const admin = yield* readConfig(adminBindings);
    assert.strictEqual(admin.APP_ORIGIN, settings.origins.admin);
    assert.strictEqual(admin.APP_RELEASE, release);
    assert.isUndefined(yield* readAi(adminBindings));
    assert.isDefined(yield* readAi(userBindings));
    const missing = yield* readConfig({ ...userBindings, DB: undefined }).pipe(Effect.flip);
    assert.instanceOf(missing, ConfigurationInvalid);
  }),
);
