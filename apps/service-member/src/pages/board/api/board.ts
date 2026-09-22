import { absent, apiData, apiDataOrNone } from "@repo/runtime/client";
import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import {
  BoardPostCreated,
  BoardThreadCreated,
  BoardThreadList,
  BoardThreadView,
} from "#shared/contracts/index.ts";

import type { ApiReply } from "@repo/runtime/client";

type ThreadList = typeof BoardThreadList.Type;
type Thread = typeof BoardThreadView.Type;

function loadThreads(page: number): Promise<ThreadList> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.board.threads
      .get({ query: { page: String(page) } })
      .then((response: ApiReply) => apiData(BoardThreadList, response)),
  );
}

function loadThread(id: string, page: number): Promise<Thread> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.board.thread.get({ query: { id, page: String(page) } }).then((response: ApiReply) => {
      const thread = apiDataOrNone(BoardThreadView, response, absent.notFound);
      if (thread === undefined) {
        throw notFound();
      }
      return thread;
    }),
  );
}

function openThread(title: string, body: string): Promise<string> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.board.threads
      .post({ body, title })
      .then((response: ApiReply) => apiData(BoardThreadCreated, response).id),
  );
}

function replyToThread(threadId: string, body: string): Promise<string> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.board.posts
      .post({ body, threadId })
      .then((response: ApiReply) => apiData(BoardPostCreated, response).id),
  );
}

export { loadThread, loadThreads, openThread, replyToThread };
export type { Thread, ThreadList };
