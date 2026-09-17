import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { expect, test } from "vite-plus/test";
import { Miniflare } from "miniflare";
import * as v from "valibot";
import { remoteExecutor } from "./remote-http.ts";
import { runRemoteDatabaseCommand } from "./remote-command.ts";
import { createDb } from "./index.ts";
import { user } from "./schema.ts";

const target = {
  accountId: "a".repeat(32),
  databaseId: "92b705e4-7b3b-42a9-9de3-700a33fa609c",
  apiToken: "test-private-token-at-least-20-characters",
};
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${target.accountId}/d1/database/${target.databaseId}/query`;
const batchSchema = v.object({
  batch: v.array(
    v.object({ sql: v.string(), params: v.array(v.union([v.string(), v.number(), v.null()])) }),
  ),
});

test("plan never accesses the network or discloses credentials and bootstrap identity", async () => {
  const server = setupServer();
  server.listen({ onUnhandledRequest: "error" });
  try {
    const output = await runRemoteDatabaseCommand(["bootstrap", "--plan"], {
      ...target,
      email: "private@example.test",
    });
    expect(output).toMatchObject({ ok: true, remoteStateVerified: false });
    expect(JSON.stringify(output)).not.toContain(target.apiToken);
    expect(JSON.stringify(output)).not.toContain("private@example.test");
  } finally {
    server.close();
  }
});

test("remote command uses the official HTTP batch contract with real D1 execution", async () => {
  const runtime = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('test-database'); } };",
    compatibilityDate: "2026-07-30",
    d1Databases: { DB: "remote-http-test" },
  });
  const binding = await runtime.getD1Database("DB");
  const server = setupServer(
    http.post(endpoint, async ({ request }) => {
      if (request.headers.get("authorization") !== `Bearer ${target.apiToken}`)
        return new HttpResponse(null, { status: 401 });
      const body = v.parse(batchSchema, await request.json());
      const result = await binding.batch(
        body.batch.map((query) => binding.prepare(query.sql).bind(...query.params)),
      );
      return HttpResponse.json({ success: true, result });
    }),
  );
  server.listen({ onUnhandledRequest: "error" });
  const execute = ["--execute", "--confirm-database", target.databaseId];
  try {
    expect(await runRemoteDatabaseCommand(["migrate", ...execute], target)).toMatchObject({
      ok: true,
      event: "database.remote_migrated",
    });
    expect(await runRemoteDatabaseCommand(["migrate", ...execute], target)).toMatchObject({
      applied: 0,
    });
    await createDb(binding).insert(user).values({
      id: "first",
      name: "Private Name",
      email: "private@example.test",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const output = await runRemoteDatabaseCommand(["bootstrap", ...execute], {
      ...target,
      email: "private@example.test",
    });
    expect(output).toEqual({
      ok: true,
      event: "database.remote_admin_bootstrapped",
      databaseId: target.databaseId,
    });
    const users = await createDb(binding).select().from(user);
    expect(users[0]?.role).toBe("admin");
    expect(users[0]?.securityVersion).toBe(1);
  } finally {
    server.close();
    await runtime.dispose();
  }
});

test.for(["http", "partial", "invalid", "redirect"] as const)(
  "sanitizes %s failure without returning provider bodies or secrets",
  async (mode) => {
    const server = setupServer(
      http.post(endpoint, () => {
        if (mode === "redirect")
          return HttpResponse.redirect("https://untrusted.example.test/", 302);
        if (mode === "http") return HttpResponse.json({ error: target.apiToken }, { status: 403 });
        if (mode === "partial")
          return HttpResponse.json({
            success: true,
            result: [{ success: false, error: target.apiToken, results: [] }],
          });
        return HttpResponse.text(target.apiToken);
      }),
    );
    server.listen({ onUnhandledRequest: "error" });
    try {
      await expect(remoteExecutor(target).batch([{ sql: "SELECT 1", params: [] }])).rejects.toThrow(
        /^REMOTE_QUERY_FAILED$/,
      );
    } finally {
      server.close();
    }
  },
);
