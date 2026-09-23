import { assert, it } from "@effect/vitest";
import { NOTIFICATION_KIND, userInboxBinding } from "@repo/config";
import { env } from "cloudflare:workers";
import { Effect, Schema } from "effect";

import {
  CreateFeedPost,
  CreateNotification,
  FeedPostRecord,
  NotificationRecord,
} from "./messages.ts";

declare global {
  namespace Cloudflare {
    interface Env {
      readonly USER_INBOX: DurableObjectNamespace;
    }
  }
}

it.effect("stores a notification and a feed post for one user", () =>
  Effect.gen(function* program() {
    const namespace = env[userInboxBinding];
    const stub = namespace.get(namespace.idFromName("member-1"));
    const posted = <Created, Stored>(
      path: string,
      created: Schema.Codec<Created, Created>,
      stored: Schema.Codec<Stored, Stored>,
      body: Created,
    ): Effect.Effect<Stored> =>
      Effect.gen(function* publish() {
        const encoded = yield* Schema.encodeEffect(Schema.fromJsonString(created))(body);
        const response = yield* Effect.promise(() =>
          stub.fetch(`https://inbox.internal/${path}`, {
            body: encoded,
            headers: { "content-type": "application/json" },
            method: "POST",
          }),
        );
        return yield* Schema.decodeEffect(Schema.fromJsonString(stored))(
          yield* Effect.promise(() => response.text()),
        );
      }).pipe(Effect.orDie);
    const notification = yield* posted("notifications", CreateNotification, NotificationRecord, {
      id: "n1",
      kind: NOTIFICATION_KIND.follow,
      subjectId: "actor-1",
    });
    const post = yield* posted("posts", CreateFeedPost, FeedPostRecord, {
      actorId: "actor-1",
      body: "hello",
      id: "p1",
      threadId: "t1",
      title: "thread",
    });
    assert.strictEqual(notification.id, "n1");
    assert.strictEqual(post.id, "p1");
    const response = yield* Effect.promise(() => stub.fetch("https://inbox.internal/snapshot"));
    const snapshot = yield* Effect.promise(() => response.json());
    assert.deepStrictEqual(snapshot, {
      notifications: [notification],
      posts: [post],
    });
  }),
);
