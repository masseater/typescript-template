import { DateTime, Effect, Result, Schema } from "effect";

import { inboxRouteOf } from "./inbox-route.ts";
import {
  CreateFeedPost,
  CreateNotification,
  FeedPostRecord,
  InboxEvent,
  MarkRead,
  NotificationKind,
  NotificationRecord,
} from "./messages.ts";

import type { InboxRoute } from "./inbox-route.ts";

interface InboxBindings {
  readonly USER_INBOX: DurableObjectNamespace;
}

const schemaVersion = 1;

const NotificationRow = Schema.Struct({
  created_at: Schema.Finite,
  id: Schema.String,
  kind: NotificationKind,
  read_at: Schema.NullOr(Schema.Finite),
  subject_id: Schema.String,
});

const FeedPostRow = Schema.Struct({
  actor_id: Schema.String,
  body: Schema.String,
  created_at: Schema.Finite,
  id: Schema.String,
  thread_id: Schema.String,
  title: Schema.String,
});

const encodeEventJson = Schema.encodeEffect(Schema.fromJsonString(InboxEvent));
const decodeNotificationRow = Schema.decodeUnknownResult(NotificationRow);
const decodeFeedPostRow = Schema.decodeUnknownResult(FeedPostRow);

function notificationOf(row: typeof NotificationRow.Type): NotificationRecord {
  return {
    createdAt: row.created_at,
    id: row.id,
    kind: row.kind,
    readAt: row.read_at,
    subjectId: row.subject_id,
  };
}

function feedPostOf(row: typeof FeedPostRow.Type): FeedPostRecord {
  return {
    actorId: row.actor_id,
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
    threadId: row.thread_id,
    title: row.title,
  };
}

function nowMillis(): number {
  return DateTime.toEpochMillis(DateTime.nowUnsafe());
}

class UserInbox {
  private readonly ctx: DurableObjectState;

  public constructor(ctx: DurableObjectState, _env: InboxBindings) {
    this.ctx = ctx;
    this.migrate();
  }

  private migrate(): void {
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS schema_migration (id INTEGER PRIMARY KEY NOT NULL)",
    );
    const version = this.ctx.storage.sql
      .exec<{ version: number }>("SELECT COALESCE(MAX(id), 0) AS version FROM schema_migration")
      .one().version;
    if (version >= schemaVersion) {
      return;
    }
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS notification (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, subject_id TEXT NOT NULL, created_at INTEGER NOT NULL, read_at INTEGER)",
    );
    this.ctx.storage.sql.exec(
      "CREATE INDEX IF NOT EXISTS notification_created_at_idx ON notification (created_at DESC)",
    );
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS feed_post (id TEXT PRIMARY KEY NOT NULL, thread_id TEXT NOT NULL, actor_id TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL)",
    );
    this.ctx.storage.sql.exec(
      "CREATE INDEX IF NOT EXISTS feed_post_created_at_idx ON feed_post (created_at DESC)",
    );
    this.ctx.storage.sql.exec("INSERT INTO schema_migration (id) VALUES (?)", schemaVersion);
  }

  public fetch(request: Request): Promise<Response> {
    const route = inboxRouteOf(request);
    if (route === undefined) {
      return Promise.resolve(new Response(undefined, { status: 404 }));
    }
    const handlers: Readonly<Record<InboxRoute, (routed: Request) => Promise<Response>>> = {
      feedPost: (routed) => this.createFeedPost(routed),
      markRead: (routed) => this.markNotificationsRead(routed),
      notification: (routed) => this.createNotification(routed),
      snapshot: () => Promise.resolve(Response.json(this.snapshot())),
      socket: () => Promise.resolve(this.acceptSocket()),
    };
    return handlers[route](request);
  }

  private acceptSocket(): Response {
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    const encoded = Result.getOrElse(
      Schema.encodeResult(Schema.fromJsonString(InboxEvent))({
        notifications: this.listNotifications(),
        posts: this.listFeedPosts(),
        type: "snapshot",
      }),
      () => undefined,
    );
    if (encoded !== undefined) {
      pair[1].send(encoded);
    }
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  public webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") {
      return Promise.resolve();
    }
    const parsed = Result.getOrElse(
      Schema.decodeResult(Schema.fromJsonString(MarkRead))(message),
      () => undefined,
    );
    if (parsed === undefined) {
      return Promise.resolve();
    }
    this.markRead(parsed.ids);
    return Effect.runPromise(
      Effect.gen({ self: this }, function* pushSnapshot() {
        socket.send(
          yield* encodeEventJson({
            notifications: this.listNotifications(),
            posts: this.listFeedPosts(),
            type: "snapshot",
          }),
        );
      }),
    );
  }

  private createNotification(request: Request): Promise<Response> {
    return Effect.runPromise(
      Effect.gen({ self: this }, function* create() {
        const decoded = Schema.decodeResult(Schema.fromJsonString(CreateNotification))(
          yield* Effect.promise(() => request.text()),
        );
        if (Result.isFailure(decoded)) {
          return new Response(undefined, { status: 400 });
        }
        const record = this.insertNotification(decoded.success);
        yield* Effect.promise(() => this.broadcast({ notification: record, type: "notification" }));
        return Response.json(record);
      }),
    );
  }

  private createFeedPost(request: Request): Promise<Response> {
    return Effect.runPromise(
      Effect.gen({ self: this }, function* create() {
        const decoded = Schema.decodeResult(Schema.fromJsonString(CreateFeedPost))(
          yield* Effect.promise(() => request.text()),
        );
        if (Result.isFailure(decoded)) {
          return new Response(undefined, { status: 400 });
        }
        const record = this.insertFeedPost(decoded.success);
        yield* Effect.promise(() => this.broadcast({ post: record, type: "feed_post" }));
        return Response.json(record);
      }),
    );
  }

  private markNotificationsRead(request: Request): Promise<Response> {
    return Effect.runPromise(
      Effect.gen({ self: this }, function* mark() {
        const decoded = Schema.decodeResult(Schema.fromJsonString(MarkRead))(
          yield* Effect.promise(() => request.text()),
        );
        if (Result.isFailure(decoded)) {
          return new Response(undefined, { status: 400 });
        }
        this.markRead(decoded.success.ids);
        return Response.json({ ok: true });
      }),
    );
  }

  private insertNotification(input: CreateNotification): NotificationRecord {
    const createdAt = nowMillis();
    this.ctx.storage.sql.exec(
      "INSERT INTO notification (id, kind, subject_id, created_at, read_at) VALUES (?, ?, ?, ?, NULL)",
      input.id,
      input.kind,
      input.subjectId,
      createdAt,
    );
    return {
      createdAt,
      id: input.id,
      kind: input.kind,
      readAt: null,
      subjectId: input.subjectId,
    };
  }

  private insertFeedPost(input: CreateFeedPost): FeedPostRecord {
    const createdAt = nowMillis();
    this.ctx.storage.sql.exec(
      "INSERT INTO feed_post (id, thread_id, actor_id, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      input.id,
      input.threadId,
      input.actorId,
      input.title,
      input.body,
      createdAt,
    );
    return {
      actorId: input.actorId,
      body: input.body,
      createdAt,
      id: input.id,
      threadId: input.threadId,
      title: input.title,
    };
  }

  private markRead(ids: readonly string[]): void {
    const readAt = nowMillis();
    for (const id of ids) {
      this.ctx.storage.sql.exec(
        "UPDATE notification SET read_at = ? WHERE id = ? AND read_at IS NULL",
        readAt,
        id,
      );
    }
  }

  private listNotifications(): readonly NotificationRecord[] {
    return this.ctx.storage.sql
      .exec(
        "SELECT id, kind, subject_id, created_at, read_at FROM notification ORDER BY created_at DESC LIMIT 100",
      )
      .toArray()
      .flatMap((row) => {
        const decoded = decodeNotificationRow(row);
        return Result.isSuccess(decoded) ? [notificationOf(decoded.success)] : [];
      });
  }

  private listFeedPosts(): readonly FeedPostRecord[] {
    return this.ctx.storage.sql
      .exec(
        "SELECT id, thread_id, actor_id, title, body, created_at FROM feed_post ORDER BY created_at DESC LIMIT 50",
      )
      .toArray()
      .flatMap((row) => {
        const decoded = decodeFeedPostRow(row);
        return Result.isSuccess(decoded) ? [feedPostOf(decoded.success)] : [];
      });
  }

  private snapshot(): {
    readonly notifications: readonly NotificationRecord[];
    readonly posts: readonly FeedPostRecord[];
  } {
    return {
      notifications: this.listNotifications(),
      posts: this.listFeedPosts(),
    };
  }

  private broadcast(event: InboxEvent): Promise<void> {
    const sockets = this.ctx.getWebSockets();
    return Effect.runPromise(
      Effect.gen(function* send() {
        const payload = yield* encodeEventJson(event);
        for (const socket of sockets) {
          socket.send(payload);
        }
      }),
    );
  }
}

Object.defineProperty(UserInbox, "name", { value: "UserInbox" });

export { UserInbox };
export type { InboxBindings };
