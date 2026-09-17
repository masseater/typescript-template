import { describe, expect, it } from "vite-plus/test";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { text } from "node:stream/consumers";

const ACCOUNT_ID_LENGTH = 32;
const COMMAND_TIMEOUT_MS = 10_000;

interface CommandResult {
  code: number | null;
  error: string;
  output: string;
}

async function command(args: readonly string[], input: string): Promise<CommandResult> {
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("remote-cli.ts", import.meta.url)), ...args],
    { env: {}, stdio: ["pipe", "pipe", "pipe"], timeout: COMMAND_TIMEOUT_MS },
  );
  child.stdin.end(input);
  const [output, error] = await Promise.all([
    text(child.stdout),
    text(child.stderr),
    once(child, "close"),
  ]);
  return { code: child.exitCode, error, output };
}

describe("remote database CLI", () => {
  it("emits a structured offline plan with an empty environment", async () => {
    expect.hasAssertions();
    const result = await command(
      ["migrate", "--plan"],
      JSON.stringify({
        accountId: "a".repeat(ACCOUNT_ID_LENGTH),
        databaseId: "92b705e4-7b3b-42a9-9de3-700a33fa609c",
      }),
    );
    expect(result.code).toBe(0);
    expect(JSON.parse(result.output)).toMatchObject({
      event: "database.remote_plan",
      ok: true,
      remoteStateVerified: false,
    });
    expect(result.error).toBe("");
  });

  it("rejects malformed private input without echoing it", async () => {
    expect.hasAssertions();
    const result = await command(["bootstrap", "--plan"], "malformed-secret-private-token");
    expect(result.code).toBe(1);
    expect(result.output).toBe("");
    expect(result.error).not.toContain("malformed-secret-private-token");
    expect(JSON.parse(result.error)).toMatchObject({ code: "REMOTE_DATABASE_FAILED", ok: false });
  });

  it("refuses execution without a matching target confirmation", async () => {
    expect.hasAssertions();
    const result = await command(
      ["migrate", "--execute"],
      JSON.stringify({
        accountId: "a".repeat(ACCOUNT_ID_LENGTH),
        apiToken: "test-private-token-at-least-20-characters",
        databaseId: "92b705e4-7b3b-42a9-9de3-700a33fa609c",
      }),
    );
    expect(result.code).toBe(1);
    expect(JSON.parse(result.error)).toMatchObject({ code: "REMOTE_COMMAND_INVALID" });
  });
});
