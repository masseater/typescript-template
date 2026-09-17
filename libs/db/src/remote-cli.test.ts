import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

function command(args: string[], input: string) {
  return new Promise<{ code: number | null; output: string; error: string }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL("remote-cli.ts", import.meta.url)), ...args],
      {
        env: {},
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 10000,
      },
    );
    let output = "";
    let error = "";
    child.stdout.on("data", (value: Buffer) => {
      output += value.toString();
    });
    child.stderr.on("data", (value: Buffer) => {
      error += value.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output, error }));
    child.stdin.end(input);
  });
}

test("standalone CLI emits a structured offline plan with an empty environment", async () => {
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

test("standalone CLI rejects malformed private input without echoing it", async () => {
  const result = await command(["bootstrap", "--plan"], "malformed-secret-private-token");
  expect(result.code).toBe(1);
  expect(result.output).toBe("");
  expect(result.error).not.toContain("malformed-secret-private-token");
  expect(JSON.parse(result.error)).toMatchObject({ ok: false, code: "REMOTE_DATABASE_FAILED" });
});

test("standalone CLI refuses execution without a matching target confirmation", async () => {
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
