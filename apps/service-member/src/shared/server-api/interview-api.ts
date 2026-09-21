import { verifySession } from "@repo/auth";
import { httpStatus } from "@repo/observability";
import { sessionFailures } from "@repo/runtime/account";
import { createApi } from "@repo/runtime/http";
import { Effect, Schema } from "effect";

import { InterviewView, Utterance } from "#shared/interview/contracts.ts";
import {
  openInterview,
  restartInterview,
  saveInterview,
  takeTurn,
} from "#shared/interview/index.ts";

import type { Interviewer } from "#shared/interview/index.ts";
import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const Empty = Schema.Struct({});
const conflictFailures = {
  ...sessionFailures,
  InterviewConflict: {
    message: "別の画面で会話が進んでいます。読み込み直してください。",
    status: httpStatus.conflict,
  },
};
const rejectedFailures = {
  ...conflictFailures,
  TurnRejected: { message: "いまはその操作を受け付けられません。", status: httpStatus.conflict },
};
const turnFailures = {
  ...rejectedFailures,
  InterviewLimitReached: {
    message: "今日はこれ以上話せません。スキップと終了は使えます。明日また話しかけてください。",
    status: httpStatus.tooManyRequests,
  },
};

const open = Effect.fn("interview.api.open")(function* open(request: Request) {
  const { user } = yield* verifySession(request.headers);
  return yield* openInterview(user.id);
});

const turn = Effect.fn("interview.api.turn")(function* turn(
  request: Request,
  utterance: typeof Utterance.Type,
) {
  const { user } = yield* verifySession(request.headers);
  return yield* takeTurn(user.id, utterance);
});

const saveSheet = Effect.fn("interview.api.save")(function* saveSheet(request: Request) {
  const { user } = yield* verifySession(request.headers);
  return yield* saveInterview(user.id);
});

const restart = Effect.fn("interview.api.restart")(function* restart(request: Request) {
  const { user } = yield* verifySession(request.headers);
  return yield* restartInterview(user.id);
});

function interviewApi(api: ApiRoutes<AppServices | Interviewer>) {
  return createApi("")
    .get("/interview", ...api.route({ response: InterviewView }, open, conflictFailures))
    .post(
      "/interview/turns",
      ...api.route({ body: Utterance, response: InterviewView }, turn, turnFailures),
    )
    .post(
      "/interview/sheet",
      ...api.route({ body: Empty, response: InterviewView }, saveSheet, rejectedFailures),
    )
    .post(
      "/interview/restart",
      ...api.route({ body: Empty, response: InterviewView }, restart, conflictFailures),
    );
}

export { interviewApi };
