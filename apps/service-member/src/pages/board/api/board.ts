import { absent, apiData, apiDataOrNone } from "@repo/runtime/client";
import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import {
  BoardPostCreated,
  BoardThreadCreated,
  BoardThreadList,
  BoardThreadView,
} from "#shared/contracts/index.ts";

type ThreadList = typeof BoardThreadList.Type;
type Thread = typeof BoardThreadView.Type;

function loadThreads(page: number): Promise<ThreadList> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.board.threads
      .get({ query: { page: String(page) } })
      .then((response) => apiData(BoardThreadList, response)),
  );
}

function loadThread(id: string, page: number): Promise<Thread> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.board.thread.get({ query: { id, page: String(page) } }).then((response) => {
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
      .then((response) => apiData(BoardThreadCreated, response).id),
  );
}

function replyToThread(threadId: string, body: string): Promise<string> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.board.posts
      .post({ body, threadId })
      .then((response) => apiData(BoardPostCreated, response).id),
  );
}

export { loadThread, loadThreads, openThread, replyToThread };
export type { Thread, ThreadList };
