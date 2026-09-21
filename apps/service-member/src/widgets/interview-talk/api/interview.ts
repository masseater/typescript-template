import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { InterviewView } from "#shared/interview/index.ts";

import type { MemberUtterance } from "#shared/interview/index.ts";
import type { InterviewViewData } from "../model/view.ts";

async function loadInterview(): Promise<InterviewViewData> {
  const { api } = await userClient();
  return apiData(InterviewView, await api.interview.get());
}

async function postTurn(utterance: MemberUtterance): Promise<InterviewViewData> {
  const { api } = await userClient();
  return apiData(InterviewView, await api.interview.turns.post(utterance));
}

async function saveInterviewSheet(): Promise<InterviewViewData> {
  const { api } = await userClient();
  return apiData(InterviewView, await api.interview.sheet.post({}));
}

async function restartInterview(): Promise<InterviewViewData> {
  const { api } = await userClient();
  return apiData(InterviewView, await api.interview.restart.post({}));
}

export { loadInterview, postTurn, restartInterview, saveInterviewSheet };
