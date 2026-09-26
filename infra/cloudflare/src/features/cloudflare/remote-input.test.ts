import { RemoteFailure } from "@repo/db/migrations";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { parseRemoteInput } from "./remote-input.ts";

const d1Target = {
  accountId: "a".repeat(32),
  databaseId: "11111111-1111-4111-8111-111111111111",
};
const bootstrapTarget = { ...d1Target, email: "private@example.test" };

describe("parseRemoteInput", () => {
  describe.for([
    ["an operation without a mode", ["bootstrap"], bootstrapTarget, "REMOTE_COMMAND_INVALID"],
    [
      "an operation the deployment now applies itself",
      ["migrate", "--plan"],
      d1Target,
      "REMOTE_COMMAND_INVALID",
    ],
    [
      "a plan followed by a surplus argument",
      ["bootstrap", "--plan", "extra"],
      bootstrapTarget,
      "REMOTE_COMMAND_INVALID",
    ],
    [
      "an execution without an API token",
      ["bootstrap", "--execute", "--confirm-database", d1Target.databaseId],
      bootstrapTarget,
      "REMOTE_INPUT_INVALID",
    ],
    [
      "an execution confirming another database",
      ["bootstrap", "--execute", "--confirm-database", "wrong"],
      { ...bootstrapTarget, apiToken: "test-token-at-least-20-characters" },
      "REMOTE_TARGET_MISMATCH",
    ],
    [
      "a placeholder database",
      ["bootstrap", "--plan"],
      { ...bootstrapTarget, databaseId: "00000000-0000-0000-0000-000000000001" },
      "REMOTE_INPUT_INVALID",
    ],
    ["a bootstrap without an email", ["bootstrap", "--plan"], d1Target, "REMOTE_INPUT_INVALID"],
    [
      "a bootstrap with an invalid email",
      ["bootstrap", "--plan"],
      { ...d1Target, email: "private-invalid-email" },
      "REMOTE_INPUT_INVALID",
    ],
  ] as const)("%s", ([, commandArguments, input, expectedCode]) => {
    const it = test.extend("refusal", () =>
      Effect.runPromise(Effect.flip(parseRemoteInput(commandArguments, input))));

    it("is refused with the code that names what is wrong", ({ refusal }) => {
      expect(refusal).toStrictEqual(RemoteFailure.make({ code: expectedCode }));
    });
  });

  describe("a plan for a real database", () => {
    const it = test.extend("remoteInput", () =>
      Effect.runPromise(parseRemoteInput(["bootstrap", "--plan"], bootstrapTarget)));

    it("is accepted as a plan that executes nothing", ({ remoteInput }) => {
      expect(remoteInput).toStrictEqual({
        execute: false,
        operation: "bootstrap",
        target: bootstrapTarget,
      });
    });
  });
});
