import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { InterviewView } from "#shared/interview/index.ts";

import type { InterviewViewData, MemberUtterance } from "#shared/interview/index.ts";

function loadInterview(): Promise<InterviewViewData> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.interview.get().then((response) => apiData(InterviewView, response)),
  );
}

function submitTurn(utterance: MemberUtterance): Promise<InterviewViewData> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.interview.turns.post(utterance).then((response) => apiData(InterviewView, response)),
  );
}

function saveInterviewSheet(): Promise<InterviewViewData> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.interview.sheet.post({}).then((response) => apiData(InterviewView, response)),
  );
}

function restartInterviewSession(): Promise<InterviewViewData> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.interview.restart.post({}).then((response) => apiData(InterviewView, response)),
  );
}

function respondHistoryConsent(accept: boolean): Promise<InterviewViewData> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.interview["history-consent"]
      .post({ accept })
      .then((response) => apiData(InterviewView, response)),
  );
}

export {
  loadInterview,
  respondHistoryConsent,
  restartInterviewSession,
  saveInterviewSheet,
  submitTurn,
};
export type { InterviewViewData, MemberUtterance };
