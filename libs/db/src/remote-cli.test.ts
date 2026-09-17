import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { runRemoteCli } from "./remote-cli.ts";

const command = (args: string[], input: string) => runRemoteCli(args, [Buffer.from(input)]);

it.effect("CLI emits a structured offline plan", () =>
  Effect.gen(function* () {
    const result = yield* command(
      ["migrate", "--plan"],
      JSON.stringify({
        accountId: "a".repeat(32),
        databaseId: "92b705e4-7b3b-42a9-9de3-700a33fa609c",
      }),
    );
    expect(result.code).toBe(0);
    expect(JSON.parse(result.output)).toMatchObject({
      ok: true,
      event: "database.remote_plan",
      remoteStateVerified: false,
    });
    expect(result.error).toBe("");
  }),
);

it.effect("CLI rejects malformed private input without echoing it", () =>
  Effect.gen(function* () {
    const result = yield* command(["bootstrap", "--plan"], "malformed-secret-private-token");
    expect(result.code).toBe(1);
    expect(result.output).toBe("");
    expect(result.error).not.toContain("malformed-secret-private-token");
    expect(JSON.parse(result.error)).toMatchObject({ ok: false, code: "REMOTE_INPUT_INVALID" });
  }),
);

it.effect("CLI rejects non-binary input chunks", () =>
  Effect.gen(function* () {
    const result = yield* runRemoteCli(["migrate", "--plan"], ["{}"]);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.error)).toMatchObject({ ok: false, code: "REMOTE_INPUT_INVALID" });
  }),
);

it.effect("CLI refuses execution without a matching target confirmation", () =>
  Effect.gen(function* () {
    const result = yield* command(
      ["migrate", "--execute"],
      JSON.stringify({
        accountId: "a".repeat(32),
        databaseId: "92b705e4-7b3b-42a9-9de3-700a33fa609c",
        apiToken: "test-private-token-at-least-20-characters",
      }),
    );
    expect(result.code).toBe(1);
    expect(JSON.parse(result.error)).toMatchObject({ code: "REMOTE_COMMAND_INVALID" });
  }),
);
