import { Effect, Schema } from "effect";

import { userInboxBinding } from "./binding.ts";
import {
  CreateFeedPost,
  CreateNotification,
  FeedPostRecord,
  NotificationRecord,
} from "./messages.ts";

type InboxNamespace = Pick<DurableObjectNamespace, "get" | "idFromName">;

type InboxEnv = {
  readonly [userInboxBinding]?: InboxNamespace;
};

const missingInbox = "USER_INBOX binding is required";

function inboxOf(env: InboxEnv): InboxNamespace {
  const namespace = env[userInboxBinding];
  if (namespace === undefined) {
    throw new Error(missingInbox);
  }
  return namespace;
}

function stubFor(env: InboxEnv, userId: string): DurableObjectStub {
  const namespace = inboxOf(env);
  return namespace.get(namespace.idFromName(userId));
}

function openRealtime(env: InboxEnv, userId: string, request: Request): Promise<Response> {
  return stubFor(env, userId).fetch(request);
}

function publishNotification(
  env: InboxEnv,
  userId: string,
  notification: CreateNotification,
): Effect.Effect<NotificationRecord> {
  return Effect.gen(function* publish() {
    const body = yield* Schema.encodeEffect(Schema.fromJsonString(CreateNotification))(
      notification,
    );
    const response = yield* Effect.promise(() =>
      stubFor(env, userId).fetch("https://inbox.internal/notifications", {
        body,
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    if (!response.ok) {
      return yield* Effect.die(`notification_publish_failed:${response.status}`);
    }
    return yield* Schema.decodeEffect(Schema.fromJsonString(NotificationRecord))(
      yield* Effect.promise(() => response.text()),
    );
  }).pipe(Effect.orDie);
}

function publishFeedPost(
  env: InboxEnv,
  userId: string,
  post: CreateFeedPost,
): Effect.Effect<FeedPostRecord> {
  return Effect.gen(function* publish() {
    const body = yield* Schema.encodeEffect(Schema.fromJsonString(CreateFeedPost))(post);
    const response = yield* Effect.promise(() =>
      stubFor(env, userId).fetch("https://inbox.internal/posts", {
        body,
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    if (!response.ok) {
      return yield* Effect.die(`feed_post_publish_failed:${response.status}`);
    }
    return yield* Schema.decodeEffect(Schema.fromJsonString(FeedPostRecord))(
      yield* Effect.promise(() => response.text()),
    );
  }).pipe(Effect.orDie);
}

export { openRealtime, publishFeedPost, publishNotification };
