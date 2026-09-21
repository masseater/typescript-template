import { ROLE } from "@repo/config";
import { clockDate, query, schema } from "@repo/db";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { Effect } from "effect";

import { BoardMemberRequired } from "./board-member-required.ts";
import { BoardThreadNotFound } from "./board-thread-not-found.ts";

const { boardPost, boardThread, user } = schema;

interface BoardAuthor {
  readonly id: string;
  readonly name: string;
}

interface BoardThreadSummary {
  readonly author: BoardAuthor | null;
  readonly createdAt: number;
  readonly id: string;
  readonly lastPostedAt: number;
  readonly postCount: number;
  readonly title: string;
}

interface BoardPostView {
  readonly author: BoardAuthor | null;
  readonly body: string;
  readonly createdAt: number;
  readonly id: string;
}

interface Page {
  readonly limit: number;
  readonly offset: number;
}

const boardMember = and(eq(user.role, ROLE.member), eq(user.emailVerified, true));
const authorColumns = { authorId: user.id, authorName: user.name };
const threadColumns = {
  ...authorColumns,
  createdAt: boardThread.createdAt,
  id: boardThread.id,
  lastPostedAt: boardThread.lastPostedAt,
  postCount: boardThread.postCount,
  title: boardThread.title,
};
const postColumns = {
  ...authorColumns,
  body: boardPost.body,
  createdAt: boardPost.createdAt,
  id: boardPost.id,
};
function shownAuthor(row: {
  readonly authorId: string | null;
  readonly authorName: string | null;
}): BoardAuthor | null {
  return row.authorId === null || row.authorName === null
    ? null
    : { id: row.authorId, name: row.authorName };
}

function shownThread(row: {
  readonly authorId: string | null;
  readonly authorName: string | null;
  readonly createdAt: Readonly<Date>;
  readonly id: string;
  readonly lastPostedAt: Readonly<Date>;
  readonly postCount: number;
  readonly title: string;
}): BoardThreadSummary {
  return {
    author: shownAuthor(row),
    createdAt: row.createdAt.getTime(),
    id: row.id,
    lastPostedAt: row.lastPostedAt.getTime(),
    postCount: row.postCount,
    title: row.title,
  };
}

function shownPost(row: {
  readonly authorId: string | null;
  readonly authorName: string | null;
  readonly body: string;
  readonly createdAt: Readonly<Date>;
  readonly id: string;
}): BoardPostView {
  return {
    author: shownAuthor(row),
    body: row.body,
    createdAt: row.createdAt.getTime(),
    id: row.id,
  };
}

const requireBoardMember = Effect.fn("requireBoardMember")(function* requireBoardMember(
  userId: string,
) {
  const [member] = yield* query((database) =>
    database
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, userId), boardMember))
      .limit(1),
  );
  if (member === undefined) {
    return yield* new BoardMemberRequired();
  }
});

const listBoardThreads = Effect.fn("listBoardThreads")(function* listBoardThreads(
  viewerId: string,
  page: Page,
) {
  yield* requireBoardMember(viewerId);
  const threads = yield* query((database) =>
    database
      .select(threadColumns)
      .from(boardThread)
      .leftJoin(user, and(eq(user.id, boardThread.authorId), boardMember))
      .orderBy(desc(boardThread.lastPostedAt), desc(boardThread.id))
      .limit(page.limit)
      .offset(page.offset),
  );
  const [total] = yield* query((database) => database.select({ count: count() }).from(boardThread));
  return { threads: threads.map(shownThread), total: total?.count ?? 0 };
});

const findBoardThread = Effect.fn("findBoardThread")(function* findBoardThread(
  viewerId: string,
  threadId: string,
  page: Page,
) {
  yield* requireBoardMember(viewerId);
  const [thread] = yield* query((database) =>
    database
      .select(threadColumns)
      .from(boardThread)
      .leftJoin(user, and(eq(user.id, boardThread.authorId), boardMember))
      .where(eq(boardThread.id, threadId))
      .limit(1),
  );
  if (thread === undefined) {
    return yield* new BoardThreadNotFound();
  }
  const posts = yield* query((database) =>
    database
      .select(postColumns)
      .from(boardPost)
      .leftJoin(user, and(eq(user.id, boardPost.authorId), boardMember))
      .where(eq(boardPost.threadId, threadId))
      .orderBy(boardPost.createdAt, boardPost.id)
      .limit(page.limit)
      .offset(page.offset),
  );
  return { posts: posts.map(shownPost), thread: shownThread(thread), total: thread.postCount };
});

const createBoardThread = Effect.fn("createBoardThread")(function* createBoardThread(
  authorId: string,
  draft: { readonly body: string; readonly title: string },
) {
  yield* requireBoardMember(authorId);
  const now = yield* clockDate;
  const threadId = crypto.randomUUID();
  yield* query((database) =>
    database.batch([
      database.insert(boardThread).values({
        authorId,
        createdAt: now,
        id: threadId,
        lastPostedAt: now,
        postCount: 1,
        title: draft.title,
      }),
      database.insert(boardPost).values({
        authorId,
        body: draft.body,
        createdAt: now,
        id: crypto.randomUUID(),
        threadId,
      }),
    ]),
  );
  return threadId;
});

const createBoardPost = Effect.fn("createBoardPost")(function* createBoardPost(
  authorId: string,
  threadId: string,
  body: string,
) {
  yield* requireBoardMember(authorId);
  const [thread] = yield* query((database) =>
    database
      .select({ id: boardThread.id })
      .from(boardThread)
      .where(eq(boardThread.id, threadId))
      .limit(1),
  );
  if (thread === undefined) {
    return yield* new BoardThreadNotFound();
  }
  const now = yield* clockDate;
  const postId = crypto.randomUUID();
  yield* query((database) =>
    database.batch([
      database.insert(boardPost).values({ authorId, body, createdAt: now, id: postId, threadId }),
      database
        .update(boardThread)
        .set({ lastPostedAt: now, postCount: sql`${boardThread.postCount} + 1` })
        .where(eq(boardThread.id, threadId)),
    ]),
  );
  return postId;
});

export { createBoardPost, createBoardThread, findBoardThread, listBoardThreads };
