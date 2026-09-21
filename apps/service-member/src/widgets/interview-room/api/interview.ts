import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/client.ts";
import { InterviewView } from "#shared/interview/index.ts";

import type { InterviewViewData, MemberUtterance } from "#shared/interview/index.ts";

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

async function respondHistoryConsent(accept: boolean): Promise<InterviewViewData> {
  const { api } = await userClient();
  return apiData(InterviewView, await api.interview["history-consent"].post({ accept }));
}

export {
  loadInterview,
  respondHistoryConsent,
  restartInterviewSession,
  saveInterviewSheet,
  submitTurn,
};
export type { InterviewViewData, MemberUtterance };
