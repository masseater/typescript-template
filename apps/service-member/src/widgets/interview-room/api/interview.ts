import { apiData } from "@repo/runtime/client";
import { queryOptions } from "@tanstack/react-query";

import { userClient } from "#shared/api/index.ts";
import { InterviewView, Utterance } from "#shared/interview/index.ts";

import type { ApiReply } from "@repo/runtime/client";

type InterviewViewData = typeof InterviewView.Type;
type MemberUtterance = typeof Utterance.Type;

const interviewKey = ["interview"] as const;

function loadInterview(): Promise<InterviewViewData> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.interview.get().then((response: ApiReply) => apiData(InterviewView, response)),
  );
}

function submitTurn(utterance: MemberUtterance): Promise<InterviewViewData> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.interview.turns
      .post(utterance)
      .then((response: ApiReply) => apiData(InterviewView, response)),
  );
}

function saveInterviewSheet(): Promise<InterviewViewData> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.interview.sheet.post({}).then((response: ApiReply) => apiData(InterviewView, response)),
  );
}

function restartInterviewSession(): Promise<InterviewViewData> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.interview.restart.post({}).then((response: ApiReply) => apiData(InterviewView, response)),
  );
}

const interviewOptions = queryOptions({
  queryFn: loadInterview,
  queryKey: interviewKey,
  retry: false,
  staleTime: Number.POSITIVE_INFINITY,
});

export { interviewOptions, restartInterviewSession, saveInterviewSheet, submitTurn };
export type { InterviewViewData, MemberUtterance };
