import { httpStatus } from "@repo/config";
import { RequestRejected } from "@repo/observability";
import { Cause, Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { failureBy, failureResponse, inputFailures, type AnyFailureTable } from "./failures.ts";
import { InputInvalid } from "./input-invalid.ts";

const invalidInput = "入力内容を確認してください。";
const forbidden = "この操作は許可されていません。";
const unexpectedMessage = "処理に失敗しました。リクエスト ID でログを確認してください。";
const sessionFailures = {
  AdminMfaRequired: { message: forbidden, status: httpStatus.forbidden },
  AdminRequired: { message: forbidden, status: httpStatus.forbidden },
  SessionInvalid: { message: forbidden, status: httpStatus.forbidden },
  SessionRequired: { message: "ログインしてください。", status: httpStatus.unauthorized },
};
const throttledFailures = {
  Throttled: failureBy(
    [httpStatus.tooManyRequests, httpStatus.badRequest],
    (throttled: { readonly again: boolean }) =>
      throttled.again
        ? { message: "しばらく待ってください。", status: httpStatus.tooManyRequests }
        : { message: "確認できません。", status: httpStatus.badRequest },
  ),
};

const answerOf = (table: AnyFailureTable, cause: Readonly<Cause.Cause<unknown>>) =>
  Effect.runPromise(
    Effect.gen(function* failureAnswerProgram() {
      const answered = yield* failureResponse(table, cause);
      const answerBody: unknown = yield* Effect.promise(() => answered.json());
      return { body: answerBody, status: answered.status };
    }),
  );

describe.for([
  ["InputInvalid", new InputInvalid(), inputFailures.query, invalidInput, httpStatus.badRequest],
  [
    "SessionRequired",
    { _tag: "SessionRequired" },
    sessionFailures,
    "ログインしてください。",
    httpStatus.unauthorized,
  ],
  ["SessionInvalid", { _tag: "SessionInvalid" }, sessionFailures, forbidden, httpStatus.forbidden],
  ["AdminRequired", { _tag: "AdminRequired" }, sessionFailures, forbidden, httpStatus.forbidden],
  [
    "AdminMfaRequired",
    { _tag: "AdminMfaRequired" },
    sessionFailures,
    forbidden,
    httpStatus.forbidden,
  ],
  [
    "invalid_json",
    new RequestRejected({ reason: "invalid_json" }),
    inputFailures.body,
    invalidInput,
    httpStatus.badRequest,
  ],
  [
    "body_required",
    new RequestRejected({ reason: "body_required" }),
    inputFailures.body,
    forbidden,
    httpStatus.badRequest,
  ],
  [
    "origin_denied",
    new RequestRejected({ reason: "origin_denied" }),
    inputFailures.body,
    forbidden,
    httpStatus.forbidden,
  ],
  [
    "json_required",
    new RequestRejected({ reason: "json_required" }),
    inputFailures.body,
    forbidden,
    httpStatus.unsupportedMediaType,
  ],
  [
    "body_too_large",
    new RequestRejected({ reason: "body_too_large" }),
    inputFailures.body,
    forbidden,
    httpStatus.payloadTooLarge,
  ],
  [
    "a throttled retry",
    { _tag: "Throttled", again: true },
    throttledFailures,
    "しばらく待ってください。",
    httpStatus.tooManyRequests,
  ],
  [
    "a throttled check",
    { _tag: "Throttled", again: false },
    throttledFailures,
    "確認できません。",
    httpStatus.badRequest,
  ],
  ["an unknown tag", { _tag: "Unmapped" }, {}, unexpectedMessage, httpStatus.internalServerError],
  [
    "a tag its route table leaves out",
    { _tag: "SessionRequired" },
    {},
    unexpectedMessage,
    httpStatus.internalServerError,
  ],
] as const)("a failure for %s", ([, caughtError, table, answerText, answerStatus]) => {
  const it = test.extend("failureAnswer", () => answerOf(table, Cause.fail(caughtError)));

  it(`is answered with ${String(answerStatus)}`, ({ failureAnswer }) => {
    expect(failureAnswer).toStrictEqual({ body: { error: answerText }, status: answerStatus });
  });
});

describe("a cause that carries no error", () => {
  const it = test.extend("failureAnswer", () => answerOf({}, Cause.die("boom")));

  it("is answered with a generic server error", ({ failureAnswer }) => {
    expect(failureAnswer).toStrictEqual({
      body: { error: unexpectedMessage },
      status: httpStatus.internalServerError,
    });
  });
});

describe("a failure only a route table names", () => {
  const it = test.extend("failureAnswer", () =>
    answerOf(
      { Conflicted: { message: "既に登録されています。", status: httpStatus.conflict } },
      Cause.fail({ _tag: "Conflicted" }),
    ));

  it("is answered by the route table", ({ failureAnswer }) => {
    expect(failureAnswer).toStrictEqual({
      body: { error: "既に登録されています。" },
      status: httpStatus.conflict,
    });
  });
});
