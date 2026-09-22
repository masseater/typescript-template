import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { spoken } from "#shared/interview/index.ts";
import {
  interviewOptions,
  restartInterviewSession,
  saveInterviewSheet,
  submitTurn,
} from "../api/interview.ts";

import type { InterviewViewData, MemberUtterance } from "../api/interview.ts";

interface InterviewSession {
  readonly busy: boolean;
  readonly failure: string | undefined;
  readonly heard: string | undefined;
  readonly loadError: string | undefined;
  readonly pending: boolean;
  readonly reload: () => void;
  readonly restart: () => void;
  readonly retry: () => void;
  readonly save: () => void;
  readonly say: (utterance: MemberUtterance) => void;
  readonly turnFailed: boolean;
  readonly typing: boolean;
  readonly view: InterviewViewData | undefined;
}

function errorText(error: Error | null): string | undefined {
  return error === null ? undefined : error.message;
}

function useInterview(onSaved?: () => Promise<void>): InterviewSession {
  const client = useQueryClient();
  const conversation = useQuery(interviewOptions);
  const publish = (view: InterviewViewData): void => {
    client.setQueryData(interviewOptions.queryKey, view);
  };
  const turn = useMutation({ mutationFn: submitTurn, onSuccess: publish });
  const save = useMutation({
    mutationFn: saveInterviewSheet,
    onSuccess: (view: InterviewViewData) => {
      publish(view);
      if (onSaved !== undefined) {
        return onSaved();
      }
      return undefined;
    },
  });
  const restart = useMutation({ mutationFn: restartInterviewSession, onSuccess: publish });
  const failedTurn = turn.isPending || turn.isError ? turn.variables : undefined;
  const failure = errorText(turn.error ?? save.error ?? restart.error);
  const say = (utterance: MemberUtterance): void => {
    turn.mutate(utterance);
  };
  const retry = (): void => {
    if (failedTurn !== undefined) {
      turn.mutate(failedTurn);
    }
  };
  const reload = (): void => {
    void conversation.refetch();
  };
  return {
    busy: turn.isPending || save.isPending || restart.isPending,
    failure,
    heard: failedTurn === undefined ? undefined : spoken(failedTurn),
    loadError: errorText(conversation.error),
    pending: conversation.isFetching,
    reload,
    restart: () => {
      restart.mutate();
    },
    retry,
    save: () => {
      save.mutate();
    },
    say,
    turnFailed: turn.isError,
    typing: turn.isPending,
    view: conversation.data,
  };
}

export { useInterview };
