import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { followMember, homeFeed } from "./member-social.ts";
import { addUser } from "./records-fixture.ts";
import { TestDatabase } from "./testing.ts";

it.effect("omits members the viewer does not follow", () =>
  Effect.gen(function* program() {
    yield* addUser("viewer");
    yield* addUser("followed");
    yield* addUser("stranger");
    yield* followMember("viewer", "followed");
    const feed = yield* homeFeed("viewer");
    assert.deepStrictEqual(
      feed.map((item) => item.actorId),
      ["followed"],
    );
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("omits unverified followees from the feed", () =>
  Effect.gen(function* program() {
    yield* addUser("viewer");
    yield* addUser("unverified", "member", false);
    yield* followMember("viewer", "unverified");
    assert.deepStrictEqual(yield* homeFeed("viewer"), []);
  }).pipe(Effect.provide(TestDatabase)),
);
