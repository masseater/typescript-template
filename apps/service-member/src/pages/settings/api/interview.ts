import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { InterviewView } from "#shared/contracts/index.ts";

async function loadInterviewView(): Promise<typeof InterviewView.Type> {
  const { api } = await userClient();
  return apiData(InterviewView, await api.interview.get());
}

export { loadInterviewView };
