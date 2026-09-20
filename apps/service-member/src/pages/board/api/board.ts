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

async function loadThreads(page: number): Promise<ThreadList> {
  const { api } = await userClient();
  return apiData(BoardThreadList, await api.board.threads.get({ query: { page: String(page) } }));
}

async function loadThread(id: string, page: number): Promise<Thread> {
  const { api } = await userClient();
  const thread = apiDataOrNone(
    BoardThreadView,
    await api.board.thread.get({ query: { id, page: String(page) } }),
    absent.notFound,
  );
  if (thread === undefined) {
    throw notFound();
  }
  return thread;
}

async function openThread(title: string, body: string): Promise<string> {
  const { api } = await userClient();
  return apiData(BoardThreadCreated, await api.board.threads.post({ body, title })).id;
}

async function replyToThread(threadId: string, body: string): Promise<string> {
  const { api } = await userClient();
  return apiData(BoardPostCreated, await api.board.posts.post({ body, threadId })).id;
}

export { loadThread, loadThreads, openThread, replyToThread };
export type { Thread, ThreadList };
