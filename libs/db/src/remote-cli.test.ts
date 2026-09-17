import { describe, expect, it } from "vite-plus/test";
import { runRemoteCli } from "./remote-cli.ts";

const ACCOUNT_ID_LENGTH = 32;

type CommandResult = Awaited<ReturnType<typeof runRemoteCli>>;

async function command(args: readonly string[], input: string): Promise<CommandResult> {
  return runRemoteCli(args, [Buffer.from(input)]);
}

describe("remote database CLI", () => {
  it("emits a structured offline plan", async () => {
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

  it("rejects non-binary input chunks", async () => {
    expect.hasAssertions();
    const result = await runRemoteCli(["migrate", "--plan"], ["{}"]);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.error)).toMatchObject({ ok: false });
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
