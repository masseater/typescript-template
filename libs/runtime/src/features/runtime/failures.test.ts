import { httpStatus } from "@repo/config";
import { RequestRejected } from "@repo/observability";
import { Cause, Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { failureBy, failureResponse, inputFailures, type AnyFailureTable } from "./failures.ts";
import { InputInvalid } from "./input-invalid.ts";

const invalidInput = "入力内容を確認してください。";
const forbidden = "この操作は許可されていません。";
const unexpectedMessage = "処理に失敗しました。リクエスト ID でログを確認してください。";
const throttledFailures: AnyFailureTable = {
  Throttled: failureBy(
    [httpStatus.tooManyRequests, httpStatus.badRequest],
    (caughtError: { readonly again: boolean }) =>
      caughtError.again
        ? { message: "しばらく待ってください。", status: httpStatus.tooManyRequests }
        : { message: "確認できません。", status: httpStatus.badRequest },
  ),
};
const pendingFailures: AnyFailureTable = {
  Pending: failureBy(
    [httpStatus.preconditionRequired],
    (caughtError: { readonly kinds: readonly string[] }) => ({
      details: { error: "overridden", kinds: caughtError.kinds },
      message: "同意が必要です。",
      status: httpStatus.preconditionRequired,
    }),
  ),
};
const sessionFailures = {
  AdminMfaRequired: { message: forbidden, status: httpStatus.forbidden },
  AdminRequired: { message: forbidden, status: httpStatus.forbidden },
  SessionInvalid: { message: forbidden, status: httpStatus.forbidden },
  SessionRequired: { message: "ログインしてください。", status: httpStatus.unauthorized },
};

describe.for([
  [
    "InputInvalid",
    inputFailures.query,
    Cause.fail(InputInvalid.make()),
    { error: invalidInput },
    httpStatus.badRequest,
  ],
  [
    "SessionRequired",
    sessionFailures,
    Cause.fail({ _tag: "SessionRequired" }),
    { error: "ログインしてください。" },
    httpStatus.unauthorized,
  ],
  [
    "SessionInvalid",
    sessionFailures,
    Cause.fail({ _tag: "SessionInvalid" }),
    { error: forbidden },
    httpStatus.forbidden,
  ],
  [
    "AdminRequired",
    sessionFailures,
    Cause.fail({ _tag: "AdminRequired" }),
    { error: forbidden },
    httpStatus.forbidden,
  ],
  [
    "AdminMfaRequired",
    sessionFailures,
    Cause.fail({ _tag: "AdminMfaRequired" }),
    { error: forbidden },
    httpStatus.forbidden,
  ],
  [
    "invalid_json",
    inputFailures.body,
    Cause.fail(RequestRejected.make({ reason: "invalid_json" })),
    { error: invalidInput },
    httpStatus.badRequest,
  ],
  [
    "body_required",
    inputFailures.body,
    Cause.fail(RequestRejected.make({ reason: "body_required" })),
    { error: forbidden },
    httpStatus.badRequest,
  ],
  [
    "origin_denied",
    inputFailures.body,
    Cause.fail(RequestRejected.make({ reason: "origin_denied" })),
    { error: forbidden },
    httpStatus.forbidden,
  ],
  [
    "json_required",
    inputFailures.body,
    Cause.fail(RequestRejected.make({ reason: "json_required" })),
    { error: forbidden },
    httpStatus.unsupportedMediaType,
  ],
  [
    "body_too_large",
    inputFailures.body,
    Cause.fail(RequestRejected.make({ reason: "body_too_large" })),
    { error: forbidden },
    httpStatus.payloadTooLarge,
  ],
  [
    "an unknown tag",
    {},
    Cause.fail({ _tag: "Unmapped" }),
    { error: unexpectedMessage },
    httpStatus.internalServerError,
  ],
  [
    "a cause that carries no error",
    {},
    Cause.die("boom"),
    { error: unexpectedMessage },
    httpStatus.internalServerError,
  ],
  [
    "a tag only a route table names",
    { Conflicted: { message: "既に登録されています。", status: httpStatus.conflict } },
    Cause.fail({ _tag: "Conflicted" }),
    { error: "既に登録されています。" },
    httpStatus.conflict,
  ],
  [
    "a failureBy mapping that picks its first status",
    throttledFailures,
    Cause.fail({ _tag: "Throttled", again: true }),
    { error: "しばらく待ってください。" },
    httpStatus.tooManyRequests,
  ],
  [
    "a failureBy mapping that picks its second status",
    throttledFailures,
    Cause.fail({ _tag: "Throttled", again: false }),
    { error: "確認できません。" },
    httpStatus.badRequest,
  ],
  [
    "a route table entry that attaches details",
    pendingFailures,
    Cause.fail({ _tag: "Pending", kinds: ["terms"] }),
    { error: "同意が必要です。", kinds: ["terms"] },
    httpStatus.preconditionRequired,
  ],
] as const)("a failure for %s", ([, table, cause, answerBody, answerStatus]) => {
  const it = test.extend("failureAnswer", () =>
    Effect.runPromise(
      Effect.gen(function* failureAnswerProgram() {
        const answered = yield* failureResponse(table, cause);
        const answeredBody: unknown = yield* Effect.promise(() => answered.json());
        return { body: answeredBody, status: answered.status };
      }),
    ));

  it(`is answered with ${String(answerStatus)}`, ({ failureAnswer }) => {
    expect(failureAnswer).toStrictEqual({ body: answerBody, status: answerStatus });
  });
});
