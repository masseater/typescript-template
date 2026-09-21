import { Effect, Result, Schema } from "effect";

import { userInboxBinding } from "./binding.ts";
import { FeedPostRecord, NotificationRecord } from "./messages.ts";

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
  notification: Readonly<{
    readonly id: string;
    readonly kind: NotificationRecord["kind"];
    readonly subjectId: string;
  }>,
): Effect.Effect<NotificationRecord> {
  return Effect.gen(function* publish() {
    const response = yield* Effect.promise(async () =>
      stubFor(env, userId).fetch("https://inbox.internal/notifications", {
        body: JSON.stringify(notification),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    if (!response.ok) {
      return yield* Effect.die(`notification_publish_failed:${response.status}`);
    }
    const body: unknown = yield* Effect.promise(async () => response.json());
    const decoded = Schema.decodeUnknownResult(NotificationRecord)(body);
    if (Result.isFailure(decoded)) {
      return yield* Effect.die("notification_publish_invalid");
    }
    return decoded.success;
  });
}

function publishFeedPost(
  env: InboxEnv,
  userId: string,
  post: Readonly<{
    readonly actorId: string;
    readonly body: string;
    readonly id: string;
    readonly threadId: string;
    readonly title: string;
  }>,
): Effect.Effect<FeedPostRecord> {
  return Effect.gen(function* publish() {
    const response = yield* Effect.promise(async () =>
      stubFor(env, userId).fetch("https://inbox.internal/posts", {
        body: JSON.stringify(post),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    if (!response.ok) {
      return yield* Effect.die(`feed_post_publish_failed:${response.status}`);
    }
    const body: unknown = yield* Effect.promise(async () => response.json());
    const decoded = Schema.decodeUnknownResult(FeedPostRecord)(body);
    if (Result.isFailure(decoded)) {
      return yield* Effect.die("feed_post_publish_invalid");
    }
    return decoded.success;
  });
}

export { openRealtime, publishFeedPost, publishNotification };
