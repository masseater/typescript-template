import { notificationKinds } from "@repo/config";
import { Schema } from "effect";

const NotificationKind = Schema.Literals(notificationKinds);

const NotificationRecord = Schema.Struct({
  createdAt: Schema.Finite,
  id: Schema.String,
  kind: NotificationKind,
  readAt: Schema.NullOr(Schema.Finite),
  subjectId: Schema.String,
});

const FeedPostRecord = Schema.Struct({
  actorId: Schema.String,
  body: Schema.String,
  createdAt: Schema.Finite,
  id: Schema.String,
  threadId: Schema.String,
  title: Schema.String,
});

const CreateNotification = Schema.Struct({
  id: Schema.String,
  kind: NotificationKind,
  subjectId: Schema.String,
});

const CreateFeedPost = Schema.Struct({
  actorId: Schema.String,
  body: Schema.String,
  id: Schema.String,
  threadId: Schema.String,
  title: Schema.String,
});

const MarkRead = Schema.Struct({
  ids: Schema.Array(Schema.String),
});

const InboxEvent = Schema.Union([
  Schema.Struct({
    notification: NotificationRecord,
    type: Schema.Literal("notification"),
  }),
  Schema.Struct({
    post: FeedPostRecord,
    type: Schema.Literal("feed_post"),
  }),
  Schema.Struct({
    notifications: Schema.Array(NotificationRecord),
    posts: Schema.Array(FeedPostRecord),
    type: Schema.Literal("snapshot"),
  }),
]);

type NotificationKind = typeof NotificationKind.Type;
type NotificationRecord = typeof NotificationRecord.Type;
type FeedPostRecord = typeof FeedPostRecord.Type;
type InboxEvent = typeof InboxEvent.Type;
type CreateNotification = typeof CreateNotification.Type;
type CreateFeedPost = typeof CreateFeedPost.Type;
type MarkRead = typeof MarkRead.Type;

export {
  CreateFeedPost,
  CreateNotification,
  FeedPostRecord,
  InboxEvent,
  MarkRead,
  NotificationKind,
  NotificationRecord,
};
