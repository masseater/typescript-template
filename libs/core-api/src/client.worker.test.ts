import { checkDatabase, type Database, type DatabaseFailure } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { Effect, Layer } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { makeCoreClient } from "./client.ts";
import { MemberRpcs } from "./member-rpcs.ts";
import { createRpcFetcher } from "./serve.ts";

describe("makeCoreClient", () => {
  const it = test.extend("databaseReady", async () => {
    const handlerLayer = MemberRpcs.toLayer({
      databaseReady: (): Effect.Effect<boolean, DatabaseFailure, Database> =>
        checkDatabase().pipe(Effect.as(true)),
    }).pipe(Layer.provide(TestDatabase));
    const rpcFetch = createRpcFetcher(MemberRpcs, handlerLayer).fetch;
    const core: Fetcher = {
      connect: (): never => Effect.runSync(Effect.die(new Error("Core RPC does not open sockets"))),
      fetch: (input, init) => rpcFetch(new Request(input, init)),
    };
    return Effect.runPromise(
      Effect.gen(function* program() {
        const client = yield* makeCoreClient(MemberRpcs, core);
        return yield* client.databaseReady({});
      }).pipe(Effect.scoped),
    );
  });

  it("round-trips over Effect RPC with real D1", ({ databaseReady }) => {
    expect(databaseReady).toStrictEqual(true);
  });
});
