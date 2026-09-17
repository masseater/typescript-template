import { expect, test } from "vite-plus/test";
import { runRemoteCli } from "./remote-cli.ts";

const command = (args: string[], input: string) => runRemoteCli(args, [Buffer.from(input)]);

test("CLI emits a structured offline plan", async () => {
  const result = await command(
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
});

test("CLI rejects malformed private input without echoing it", async () => {
  const result = await command(["bootstrap", "--plan"], "malformed-secret-private-token");
  expect(result.code).toBe(1);
  expect(result.output).toBe("");
  expect(result.error).not.toContain("malformed-secret-private-token");
  expect(JSON.parse(result.error)).toMatchObject({ ok: false, code: "REMOTE_DATABASE_FAILED" });
});

test("CLI rejects non-binary input chunks", async () => {
  const result = await runRemoteCli(["migrate", "--plan"], ["{}"]);
  expect(result.code).toBe(1);
  expect(JSON.parse(result.error)).toMatchObject({ ok: false });
});

test("CLI refuses execution without a matching target confirmation", async () => {
  const result = await command(
    ["migrate", "--execute"],
    JSON.stringify({
      accountId: "a".repeat(32),
      databaseId: "92b705e4-7b3b-42a9-9de3-700a33fa609c",
      apiToken: "test-private-token-at-least-20-characters",
    }),
  );
  expect(result.code).toBe(1);
  expect(JSON.parse(result.error)).toMatchObject({ code: "REMOTE_COMMAND_INVALID" });
});
