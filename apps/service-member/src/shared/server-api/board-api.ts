import { verifySession } from "@repo/auth";
import { httpStatus } from "@repo/observability";
import { sessionFailures } from "@repo/runtime/account";
import { createApi } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  BoardPostCreate,
  BoardPostCreated,
  BoardThreadCreate,
  BoardThreadCreated,
  BoardThreadList,
  BoardThreadListQuery,
  BoardThreadQuery,
  BoardThreadView,
  boardPostPageSize,
  boardThreadPageSize,
} from "#shared/contracts/index.ts";
import { createBoardPost, createBoardThread, findBoardThread, listBoardThreads } from "./board.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = {
  ...sessionFailures,
  BoardMemberRequired: { message: "掲示板は会員だけが使えます。", status: httpStatus.forbidden },
  BoardThreadNotFound: { message: "スレッドが見つかりません。", status: httpStatus.notFound },
};

function boardApi(api: ApiRoutes<AppServices>) {
  return createApi("/board")
    .get(
      "/threads",
      ...api.route(
        { query: BoardThreadListQuery, response: BoardThreadList },
        (request, { page }) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const list = yield* listBoardThreads(user.id, {
              limit: boardThreadPageSize,
              offset: (page - 1) * boardThreadPageSize,
            });
            return { ...list, pageSize: boardThreadPageSize };
          }),
        failures,
      ),
    )
    .post(
      "/threads",
      ...api.route(
        { body: BoardThreadCreate, response: BoardThreadCreated },
        (request, draft) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            return { id: yield* createBoardThread(user.id, draft) };
          }),
        failures,
      ),
    )
    .get(
      "/thread",
      ...api.route(
        { query: BoardThreadQuery, response: BoardThreadView },
        (request, { id, page }) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const found = yield* findBoardThread(user.id, id, {
              limit: boardPostPageSize,
              offset: (page - 1) * boardPostPageSize,
            });
            return { ...found, pageSize: boardPostPageSize };
          }),
        failures,
      ),
    )
    .post(
      "/posts",
      ...api.route(
        { body: BoardPostCreate, response: BoardPostCreated },
        (request, { body, threadId }) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            return { id: yield* createBoardPost(user.id, threadId, body) };
          }),
        failures,
      ),
    );
}

export { boardApi };
