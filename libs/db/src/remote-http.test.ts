import { HttpResponse, http } from "msw";
import { createEmptyTestDatabase, executeD1HttpBatch } from "./testing.ts";
import { describe, expect, it } from "vite-plus/test";
import type { D1Database } from "@cloudflare/workers-types";
import type { HttpResponseResolver } from "msw";
import { createDb } from "./index.ts";
import { remoteErrorCode } from "./remote-input.ts";
import { remoteExecutor } from "./remote-http.ts";
import { runRemoteDatabaseCommand } from "./remote-command.ts";
import { setupServer } from "msw/node";
import { user } from "./schema.ts";

const ACCOUNT_ID_LENGTH = 32;
const FOUND_STATUS = 302;
const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;

const target = {
  accountId: "a".repeat(ACCOUNT_ID_LENGTH),
  apiToken: "test-private-token-at-least-20-characters",
  databaseId: "92b705e4-7b3b-42a9-9de3-700a33fa609c",
};
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${target.accountId}/d1/database/${target.databaseId}/query`;
const executeArguments = ["--execute", "--confirm-database", target.databaseId];

function d1Resolver(binding: D1Database): HttpResponseResolver {
  return async ({ request }) => {
    if (request.headers.get("authorization") !== `Bearer ${target.apiToken}`) {
      return new HttpResponse(undefined, { status: UNAUTHORIZED_STATUS });
    }
    return HttpResponse.json(await executeD1HttpBatch(binding, await request.json()));
  };
}

async function withCloudflareApi(
  resolver: HttpResponseResolver | undefined,
  run: () => Promise<void>,
): Promise<void> {
  const server =
    resolver === undefined ? setupServer() : setupServer(http.post(endpoint, resolver));
  server.listen({ onUnhandledRequest: "error" });
  try {
    await run();
  } finally {
    server.close();
  }
}

const test = it.extend<{ binding: D1Database }>({
  binding: [
    async ({}, provide): Promise<void> => {
      const { binding, dispose } = await createEmptyTestDatabase("remote-http-test");
      try {
        await withCloudflareApi(d1Resolver(binding), async () => {
          await provide(binding);
        });
      } finally {
        await dispose();
      }
    },
    { auto: true },
  ],
});

const failureResponses = [
  {
    mode: "http",
    respond: (): Response =>
      HttpResponse.json({ error: target.apiToken }, { status: FORBIDDEN_STATUS }),
  },
  {
    mode: "partial",
    respond: (): Response =>
      HttpResponse.json({
        result: [{ error: target.apiToken, results: [], success: false }],
        success: true,
      }),
  },
  { mode: "invalid", respond: (): Response => HttpResponse.text(target.apiToken) },
  {
    mode: "redirect",
    respond: (): Response => HttpResponse.redirect("https://untrusted.example.test/", FOUND_STATUS),
  },
] as const;

describe("remote database plan", () => {
  it("never accesses the network or discloses credentials and bootstrap identity", async () => {
    expect.hasAssertions();
    await withCloudflareApi(undefined, async () => {
      const output = await runRemoteDatabaseCommand(["bootstrap", "--plan"], {
        ...target,
        email: "private@example.test",
      });
      expect(output).toMatchObject({ ok: true, remoteStateVerified: false });
      expect(JSON.stringify(output)).not.toContain(target.apiToken);
      expect(JSON.stringify(output)).not.toContain("private@example.test");
    });
  });

  it.for(failureResponses)(
    "sanitizes $mode failure without returning provider bodies or secrets",
    async ({ respond }) => {
      expect.hasAssertions();
      await withCloudflareApi(respond, async () => {
        await expect(
          remoteExecutor(target).batch([{ params: [], sql: "SELECT 1" }]),
        ).rejects.toThrow(/^REMOTE_QUERY_FAILED$/u);
        expect(remoteErrorCode(new Error(target.apiToken))).toBe("REMOTE_DATABASE_FAILED");
      });
    },
  );
});

describe("remote database execution over the Cloudflare HTTP API", () => {
  test("migrates through the official HTTP batch contract", async () => {
    expect.hasAssertions();
    await expect(
      runRemoteDatabaseCommand(["migrate", ...executeArguments], target),
    ).resolves.toMatchObject({ event: "database.remote_migrated", ok: true });
    await expect(
      runRemoteDatabaseCommand(["migrate", ...executeArguments], target),
    ).resolves.toMatchObject({ applied: 0 });
  });

  test("bootstraps through the official HTTP batch contract", async ({ binding }) => {
    expect.hasAssertions();
    await runRemoteDatabaseCommand(["migrate", ...executeArguments], target);
    const database = createDb(binding);
    await database.insert(user).values({
      createdAt: new Date(),
      email: "private@example.test",
      emailVerified: true,
      id: "first",
      name: "Private Name",
      updatedAt: new Date(),
    });
    await expect(
      runRemoteDatabaseCommand(["bootstrap", ...executeArguments], {
        ...target,
        email: "private@example.test",
      }),
    ).resolves.toStrictEqual({
      databaseId: target.databaseId,
      event: "database.remote_admin_bootstrapped",
      ok: true,
    });
    await expect(database.select().from(user)).resolves.toMatchObject([
      { role: "admin", securityVersion: 1 },
    ]);
  });
});
