import { assert, it } from "@effect/vitest";
import { env } from "cloudflare:workers";
import { Effect } from "effect";

import { publishFeedPost, publishNotification, userInboxBinding } from "./index.ts";

declare global {
  namespace Cloudflare {
    interface Env {
      readonly USER_INBOX: DurableObjectNamespace;
    }
  }
}

it.effect("stores a notification and a feed post for one user", () =>
  Effect.gen(function* program() {
    const userId = "member-1";
    const notification = yield* publishNotification(env, userId, {
      id: "n1",
      kind: "follow",
      subjectId: "actor-1",
    });
    const post = yield* publishFeedPost(env, userId, {
      actorId: "actor-1",
      body: "hello",
      id: "p1",
      threadId: "t1",
      title: "thread",
    });
    assert.strictEqual(notification.id, "n1");
    assert.strictEqual(post.id, "p1");
    const namespace = env[userInboxBinding];
    const stub = namespace.get(namespace.idFromName(userId));
    const response = yield* Effect.promise(() => stub.fetch("https://inbox.internal/snapshot"));
    const snapshot = yield* Effect.promise(() => response.json());
    assert.deepStrictEqual(snapshot, {
      notifications: [notification],
      posts: [post],
    });
  }),
);
