import { Effect, Result, Schema } from "effect";

import { FeedPostRecord, InboxEvent, NotificationKind, NotificationRecord } from "./messages.ts";

interface InboxBindings {
  readonly USER_INBOX: DurableObjectNamespace;
}

const schemaVersion = 1;

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

const NotificationRow = Schema.Struct({
  created_at: Schema.Number,
  id: Schema.String,
  kind: NotificationKind,
  read_at: Schema.NullOr(Schema.Number),
  subject_id: Schema.String,
});

const FeedPostRow = Schema.Struct({
  actor_id: Schema.String,
  body: Schema.String,
  created_at: Schema.Number,
  id: Schema.String,
  thread_id: Schema.String,
  title: Schema.String,
});

const encodeEvent = Schema.encodeEffect(InboxEvent);
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

class UserInbox {
  private readonly ctx: DurableObjectState;

  public constructor(ctx: DurableObjectState, _env: InboxBindings) {
    this.ctx = ctx;
    ctx.blockConcurrencyWhile(async () => {
      this.migrate();
    });
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

  public async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") === "websocket") {
      return this.acceptSocket();
    }
    const path = URL.parse(request.url)?.pathname ?? "";
    if (request.method === "POST" && path.endsWith("/notifications")) {
      return this.createNotification(request);
    }
    if (request.method === "POST" && path.endsWith("/notifications/read")) {
      return this.markNotificationsRead(request);
    }
    if (request.method === "POST" && path.endsWith("/posts")) {
      return this.createFeedPost(request);
    }
    if (request.method === "GET" && path.endsWith("/snapshot")) {
      return Response.json(this.snapshot());
    }
    return new Response(undefined, { status: 404 });
  }

  private acceptSocket(): Response {
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    const encoded = Result.getOrElse(
      Schema.encodeResult(InboxEvent)({
        notifications: this.listNotifications(),
        posts: this.listFeedPosts(),
        type: "snapshot",
      }),
      () => undefined,
    );
    if (encoded !== undefined) {
      pair[1].send(JSON.stringify(encoded));
    }
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  public async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") {
      return;
    }
    const parsedJson = Result.try((): unknown => JSON.parse(message));
    const parsed = Result.isSuccess(parsedJson)
      ? Result.getOrElse(Schema.decodeUnknownResult(MarkRead)(parsedJson.success), () => undefined)
      : undefined;
    if (parsed === undefined) {
      return;
    }
    this.markRead(parsed.ids);
    const encoded = await Effect.runPromise(
      encodeEvent({
        notifications: this.listNotifications(),
        posts: this.listFeedPosts(),
        type: "snapshot",
      }),
    );
    socket.send(JSON.stringify(encoded));
  }

  private async createNotification(request: Request): Promise<Response> {
    const body: unknown = await request.json();
    const decoded = Schema.decodeUnknownResult(CreateNotification)(body);
    if (Result.isFailure(decoded)) {
      return new Response(undefined, { status: 400 });
    }
    const record = this.insertNotification(decoded.success);
    await this.broadcast({ notification: record, type: "notification" });
    return Response.json(record);
  }

  private async createFeedPost(request: Request): Promise<Response> {
    const body: unknown = await request.json();
    const decoded = Schema.decodeUnknownResult(CreateFeedPost)(body);
    if (Result.isFailure(decoded)) {
      return new Response(undefined, { status: 400 });
    }
    const record = this.insertFeedPost(decoded.success);
    await this.broadcast({ post: record, type: "feed_post" });
    return Response.json(record);
  }

  private async markNotificationsRead(request: Request): Promise<Response> {
    const body: unknown = await request.json();
    const decoded = Schema.decodeUnknownResult(MarkRead)(body);
    if (Result.isFailure(decoded)) {
      return new Response(undefined, { status: 400 });
    }
    this.markRead(decoded.success.ids);
    return Response.json({ ok: true });
  }

  private insertNotification(input: typeof CreateNotification.Type): NotificationRecord {
    const createdAt = Date.now();
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

  private insertFeedPost(input: typeof CreateFeedPost.Type): FeedPostRecord {
    const createdAt = Date.now();
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
    const readAt = Date.now();
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

  private async broadcast(event: InboxEvent): Promise<void> {
    const encoded = await Effect.runPromise(encodeEvent(event));
    const payload = JSON.stringify(encoded);
    for (const socket of this.ctx.getWebSockets()) {
      socket.send(payload);
    }
  }
}

Object.defineProperty(UserInbox, "name", { value: "UserInbox" });

export { UserInbox };
export type { InboxBindings };
