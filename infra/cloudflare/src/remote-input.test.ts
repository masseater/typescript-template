import { RemoteFailure } from "@repo/db/migrations";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { parseRemoteInput } from "./remote-input.ts";

const d1Target = {
  accountId: "a".repeat(32),
  databaseId: "11111111-1111-4111-8111-111111111111",
};

describe("parseRemoteInput", () => {
  describe.for([
    ["an operation without a mode", ["migrate"], d1Target, "REMOTE_COMMAND_INVALID"],
    [
      "a plan followed by a surplus argument",
      ["migrate", "--plan", "extra"],
      d1Target,
      "REMOTE_COMMAND_INVALID",
    ],
    [
      "an execution without an API token",
      ["migrate", "--execute", "--confirm-database", d1Target.databaseId],
      d1Target,
      "REMOTE_INPUT_INVALID",
    ],
    [
      "an execution confirming another database",
      ["migrate", "--execute", "--confirm-database", "wrong"],
      { ...d1Target, apiToken: "test-token-at-least-20-characters" },
      "REMOTE_TARGET_MISMATCH",
    ],
    [
      "a placeholder database",
      ["migrate", "--plan"],
      { ...d1Target, databaseId: "00000000-0000-0000-0000-000000000001" },
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
    const it = test.extend("refusal", async () =>
      Effect.runPromise(Effect.flip(parseRemoteInput(commandArguments, input))));

    it("is refused with the code that names what is wrong", ({ refusal }) => {
      expect(refusal).toStrictEqual(new RemoteFailure({ code: expectedCode }));
    });
  });

  describe("a plan for a real database", () => {
    const it = test.extend("remoteInput", async () =>
      Effect.runPromise(parseRemoteInput(["migrate", "--plan"], d1Target)));

    it("is accepted as a plan that executes nothing", ({ remoteInput }) => {
      expect(remoteInput).toStrictEqual({ execute: false, operation: "migrate", target: d1Target });
    });
  });
});
