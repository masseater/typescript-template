import { Effect, Schema } from "effect";

import { verifySession } from "@repo/auth";
import { openInterview, restartInterview, saveInterview, takeTurn } from "@repo/interview";
import type { Interviewer } from "@repo/interview";
import { InterviewView, Utterance } from "@repo/interview/contracts";
import { httpStatus } from "@repo/observability";
import type { AppServices } from "@repo/runtime";
import { unavailable } from "@repo/runtime/account";
import { createApi, readJsonBody } from "@repo/runtime/http";
import type { ApiRoutes } from "@repo/runtime/http";

const Empty = Schema.Struct({});
const failures = {
  ...unavailable,
  InterviewConflict: {
    message: "別の画面で会話が進んでいます。読み込み直してください。",
    status: httpStatus.conflict,
  },
  InterviewLimitReached: {
    message: "今日はこれ以上話せません。スキップと終了は使えます。明日また話しかけてください。",
    status: httpStatus.tooManyRequests,
  },
  TurnRejected: { message: "いまはその操作を受け付けられません。", status: httpStatus.conflict },
};

const open = Effect.fn("interview.api.open")(function* open(request: Request) {
  const { user } = yield* verifySession(request.headers);
  return yield* openInterview(user.id);
});

const turn = Effect.fn("interview.api.turn")(function* turn(request: Request) {
  const { user } = yield* verifySession(request.headers);
  return yield* takeTurn(user.id, yield* readJsonBody(Utterance, request));
});

const saveSheet = Effect.fn("interview.api.save")(function* saveSheet(request: Request) {
  const { user } = yield* verifySession(request.headers);
  yield* readJsonBody(Empty, request);
  return yield* saveInterview(user.id);
});

const restart = Effect.fn("interview.api.restart")(function* restart(request: Request) {
  const { user } = yield* verifySession(request.headers);
  yield* readJsonBody(Empty, request);
  return yield* restartInterview(user.id);
});

function interviewApi(api: ApiRoutes<AppServices | Interviewer>) {
  return createApi("")
    .get("/interview", api.route(InterviewView, open, failures))
    .post("/interview/turns", api.route(InterviewView, turn, failures))
    .post("/interview/sheet", api.route(InterviewView, saveSheet, failures))
    .post("/interview/restart", api.route(InterviewView, restart, failures));
}

export { interviewApi };
