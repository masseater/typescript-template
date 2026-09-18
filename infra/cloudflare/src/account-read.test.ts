import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { HttpResponse, delay, http } from "msw";
import { setupServer } from "msw/node";

import { endpoint, readList, requestReason } from "./account-read.ts";

import type { Scope } from "effect";
import type { SetupServer } from "msw/node";

const HEX_ID_LENGTH = 32;
const PAGE_SIZE = 20;
const RESPONSE_DELAY_MS = 200;
const ABORT_DEADLINE_MS = 1;

const access = {
  accountId: "c".repeat(HEX_ID_LENGTH),
  apiToken: "account-read-test-not-a-real-token",
};
const url = `https://api.cloudflare.com/client/v4/zones/${access.accountId}/dns_records`;
const Rows = Schema.Struct({ result: Schema.Array(Schema.Struct({ name: Schema.String })) });

function mockServer(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  ...handlers: Parameters<typeof setupServer>
): Effect.Effect<SetupServer, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const server = setupServer(...handlers);
      server.listen({ onUnhandledRequest: "error" });
      return server;
    }),
    (server) =>
      Effect.sync(() => {
        server.close();
      }),
  );
}

it.effect("accepts a filtered page that Cloudflare counted against the whole collection", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(url, () =>
        HttpResponse.json({
          result: [{ name: "user.example.com" }],
          result_info: { count: 1, page: 1, per_page: 100, total_count: 37, total_pages: 1 },
        }),
      ),
    );
    const listed = yield* readList(
      access,
      {
        filter: { "name.exact": "user.example.com" },
        source: endpoint`zones/${access.accountId}/dns_records`,
      },
      Rows,
    );
    assert.deepStrictEqual(listed.result, [{ name: "user.example.com" }]);
  }).pipe(Effect.scoped),
);

it.effect("accepts an empty collection that reports a page size of zero", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(url, () =>
        HttpResponse.json({
          result: [],
          result_info: { count: 0, page: 1, per_page: 0, total_count: 0 },
        }),
      ),
    );
    const listed = yield* readList(
      access,
      {
        filter: { "name.exact": "user.example.com" },
        source: endpoint`zones/${access.accountId}/dns_records`,
      },
      Rows,
    );
    assert.deepStrictEqual(listed.result, []);
  }).pipe(Effect.scoped),
);

it.effect("accepts a collection that reports the rows it returned as the page size", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(url, () =>
        HttpResponse.json({
          result: [{ name: "user.example.com" }, { name: "admin.example.com" }],
          result_info: { count: 2, page: 1, per_page: 2, total_count: 2, total_pages: 1 },
        }),
      ),
    );
    const listed = yield* readList(
      access,
      { source: endpoint`zones/${access.accountId}/dns_records` },
      Rows,
    );
    assert.deepStrictEqual(listed.result, [
      { name: "user.example.com" },
      { name: "admin.example.com" },
    ]);
  }).pipe(Effect.scoped),
);

it.effect("refuses a page that came back as full as the page size", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(url, () =>
        HttpResponse.json({
          result: Array.from({ length: PAGE_SIZE }, (_value, index) => ({
            name: `record-${index}.example.com`,
          })),
          result_info: { count: 20, page: 1, per_page: 20, total_count: 41, total_pages: 3 },
        }),
      ),
    );
    const failure = yield* readList(
      access,
      {
        filter: { "name.exact": "user.example.com" },
        source: endpoint`zones/${access.accountId}/dns_records`,
      },
      Rows,
    ).pipe(Effect.flip);
    assert.deepStrictEqual(failure.keys, ["zones/{}/dns_records", "truncated"]);
  }).pipe(Effect.scoped),
);

it.effect("refuses an unfiltered page missing rows the collection counted", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(url, () =>
        HttpResponse.json({
          result: [{ name: "user.example.com" }],
          result_info: { count: 1, page: 1, per_page: 100, total_count: 2, total_pages: 1 },
        }),
      ),
    );
    const failure = yield* readList(
      access,
      { source: endpoint`zones/${access.accountId}/dns_records` },
      Rows,
    ).pipe(Effect.flip);
    assert.deepStrictEqual(failure.keys, ["zones/{}/dns_records", "truncated"]);
  }).pipe(Effect.scoped),
);

it.effect("reports a read the network never completed", () =>
  Effect.gen(function* program() {
    yield* mockServer(http.get(url, () => HttpResponse.error()));
    const failure = yield* readList(
      access,
      { source: endpoint`zones/${access.accountId}/dns_records` },
      Rows,
    ).pipe(Effect.flip);
    assert.deepStrictEqual(failure.keys, ["zones/{}/dns_records", "request_failed"]);
  }).pipe(Effect.scoped),
);

it.effect("reads an abort raised by a request deadline as a timeout", () =>
  Effect.gen(function* program() {
    yield* mockServer(
      http.get(url, async () => {
        await delay(RESPONSE_DELAY_MS);
        return HttpResponse.json({ result: [] });
      }),
    );
    const aborted = yield* Effect.promise(async () =>
      fetch(url, { signal: AbortSignal.any([AbortSignal.timeout(ABORT_DEADLINE_MS)]) }).then(
        () => "completed",
        (error: unknown) => error,
      ),
    );
    assert.strictEqual(requestReason(aborted), "timeout");
    assert.strictEqual(requestReason(new TypeError("fetch failed")), "request_failed");
  }).pipe(Effect.scoped),
);
