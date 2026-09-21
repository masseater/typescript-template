import { apiData } from "@repo/runtime/client";
import { queryOptions } from "@tanstack/react-query";

import { userClient } from "#shared/api/index.ts";
import { InterviewView, Utterance } from "#shared/interview/index.ts";

type InterviewViewData = typeof InterviewView.Type;
type MemberUtterance = typeof Utterance.Type;

const interviewKey = ["interview"] as const;

async function loadInterview(): Promise<InterviewViewData> {
  const { api } = await userClient();
  return apiData(InterviewView, await api.interview.get());
}

async function submitTurn(utterance: MemberUtterance): Promise<InterviewViewData> {
  const { api } = await userClient();
  return apiData(InterviewView, await api.interview.turns.post(utterance));
}

async function saveInterviewSheet(): Promise<InterviewViewData> {
  const { api } = await userClient();
  return apiData(InterviewView, await api.interview.sheet.post({}));
}

async function restartInterviewSession(): Promise<InterviewViewData> {
  const { api } = await userClient();
  return apiData(InterviewView, await api.interview.restart.post({}));
}

const interviewOptions = queryOptions({
  queryFn: loadInterview,
  queryKey: interviewKey,
  retry: false,
  staleTime: Number.POSITIVE_INFINITY,
});

export { interviewOptions, restartInterviewSession, saveInterviewSheet, submitTurn };
export type { InterviewViewData, MemberUtterance };
