import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { loadInterview, postTurn, restartInterview, saveInterviewSheet } from "../api/interview.ts";

import type { MemberUtterance } from "#shared/interview/index.ts";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import type { InterviewViewData } from "./view.ts";

interface Interview {
  readonly conversation: UseQueryResult<InterviewViewData>;
  readonly restart: UseMutationResult<InterviewViewData, Error, void>;
  readonly save: UseMutationResult<InterviewViewData, Error, void>;
  readonly turn: UseMutationResult<InterviewViewData, Error, MemberUtterance>;
}

const queryKey = ["interview"] as const;

function useInterview(onSheetSaved: (() => void) | undefined): Interview {
  const client = useQueryClient();
  const remember = (view: InterviewViewData): void => {
    client.setQueryData(queryKey, view);
  };
  return {
    conversation: useQuery({
      queryFn: loadInterview,
      queryKey,
      retry: false,
      staleTime: Number.POSITIVE_INFINITY,
    }),
    restart: useMutation({ mutationFn: restartInterview, onSuccess: remember }),
    save: useMutation({
      mutationFn: saveInterviewSheet,
      onSuccess: (view: InterviewViewData) => {
        remember(view);
        onSheetSaved?.();
      },
    }),
    turn: useMutation({ mutationFn: postTurn, onSuccess: remember }),
  };
}

export { useInterview };
export type { Interview };
