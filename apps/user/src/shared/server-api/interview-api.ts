import { Effect, Schema } from "effect";
import { InterviewView, Utterance } from "@template/interview/contracts";
import { openInterview, restartInterview, saveInterview, takeTurn } from "@template/interview";
import type { ApiRoutes } from "@template/runtime/http";
import type { AppServices } from "@template/runtime";
import type { Interviewer } from "@template/interview";
import { createApi } from "@template/runtime/http";
import { httpStatus } from "@template/observability";
import { unavailable } from "@template/runtime/account";
import { verifySession } from "@template/auth";

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

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
const open = Effect.fn("interview.api.open")(function* open(request: Request) {
  const { user } = yield* verifySession(request.headers);
  return yield* openInterview(user.id);
});

const turn = Effect.fn("interview.api.turn")(function* turn(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
  utterance: typeof Utterance.Type,
) {
  const { user } = yield* verifySession(request.headers);
  return yield* takeTurn(user.id, utterance);
});

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
const saveSheet = Effect.fn("interview.api.save")(function* saveSheet(request: Request) {
  const { user } = yield* verifySession(request.headers);
  return yield* saveInterview(user.id);
});

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
const restart = Effect.fn("interview.api.restart")(function* restart(request: Request) {
  const { user } = yield* verifySession(request.headers);
  return yield* restartInterview(user.id);
});

function interviewApi(api: ApiRoutes<AppServices | Interviewer>) {
  return createApi("")
    .get("/interview", ...api.route({ response: InterviewView }, open, failures))
    .post(
      "/interview/turns",
      ...api.route({ body: Utterance, response: InterviewView }, turn, failures),
    )
    .post(
      "/interview/sheet",
      ...api.route({ body: Empty, response: InterviewView }, saveSheet, failures),
    )
    .post(
      "/interview/restart",
      ...api.route({ body: Empty, response: InterviewView }, restart, failures),
    );
}

export { interviewApi };
