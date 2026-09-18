import { apiData } from "@repo/runtime/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { commanderClient } from "#shared/api/index.ts";
import { Done } from "#shared/contract/index.ts";
import { feedKey } from "./view.ts";

import type { UseMutationResult } from "@tanstack/react-query";

type Action<Input> = UseMutationResult<void, Error, Input>;

function useFeedRefresh(): () => void {
  const queries = useQueryClient();
  return () => {
    void queries.invalidateQueries({ queryKey: feedKey });
  };
}

function useSay(): Action<string> {
  return useMutation({
    mutationFn: async (text: string) => {
      apiData(Done, await commanderClient().chat.post({ text }));
    },
    onSettled: useFeedRefresh(),
  });
}

function useStop(): Action<void> {
  return useMutation({
    mutationFn: async () => {
      apiData(Done, await commanderClient().chat.stop.post({}));
    },
    onSettled: useFeedRefresh(),
  });
}

function useComment(taskId: string): Action<string> {
  return useMutation({
    mutationFn: async (text: string) => {
      apiData(Done, await commanderClient().tasks({ id: taskId }).comments.post({ text }));
    },
    onSettled: useFeedRefresh(),
  });
}

function useCreateLedger(): Action<void> {
  return useMutation({
    mutationFn: async () => {
      apiData(Done, await commanderClient().ledger.post({}));
    },
    onSettled: useFeedRefresh(),
  });
}

export { useComment, useCreateLedger, useSay, useStop };
