import { httpStatus } from "@repo/config";
import { RequestRejected } from "@repo/observability";
import { Cause, Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { failureResponse } from "./failures.ts";
import { InputInvalid } from "./input-invalid.ts";

const invalidInput = "入力内容を確認してください。";
const forbidden = "この操作は許可されていません。";
const unexpectedMessage = "処理に失敗しました。リクエスト ID でログを確認してください。";

describe.for([
  ["InputInvalid", new InputInvalid(), invalidInput, httpStatus.badRequest],
  [
    "SessionRequired",
    { _tag: "SessionRequired" },
    "ログインしてください。",
    httpStatus.unauthorized,
  ],
  ["SessionInvalid", { _tag: "SessionInvalid" }, forbidden, httpStatus.forbidden],
  ["AdminRequired", { _tag: "AdminRequired" }, forbidden, httpStatus.forbidden],
  ["AdminMfaRequired", { _tag: "AdminMfaRequired" }, forbidden, httpStatus.forbidden],
  [
    "invalid_json",
    new RequestRejected({ reason: "invalid_json" }),
    invalidInput,
    httpStatus.badRequest,
  ],
  [
    "body_required",
    new RequestRejected({ reason: "body_required" }),
    forbidden,
    httpStatus.badRequest,
  ],
  [
    "origin_denied",
    new RequestRejected({ reason: "origin_denied" }),
    forbidden,
    httpStatus.forbidden,
  ],
  [
    "json_required",
    new RequestRejected({ reason: "json_required" }),
    forbidden,
    httpStatus.unsupportedMediaType,
  ],
  [
    "body_too_large",
    new RequestRejected({ reason: "body_too_large" }),
    forbidden,
    httpStatus.payloadTooLarge,
  ],
  ["an unknown tag", { _tag: "Unmapped" }, unexpectedMessage, httpStatus.internalServerError],
] as const)("a failure for %s", ([, caughtError, answerText, answerStatus]) => {
  const it = test.extend("failureAnswer", () =>
    Effect.runPromise(
      Effect.gen(function* failureAnswerProgram() {
        const answered = yield* failureResponse({}, Cause.fail(caughtError));
        const answerBody: unknown = yield* Effect.promise(() => answered.json());
        return { body: answerBody, status: answered.status };
      }),
    ));

  it(`is answered with ${String(answerStatus)}`, ({ failureAnswer }) => {
    expect(failureAnswer).toStrictEqual({ body: { error: answerText }, status: answerStatus });
  });
});

describe("a cause that carries no error", () => {
  const it = test.extend("failureAnswer", () =>
    Effect.runPromise(
      Effect.gen(function* failureAnswerProgram() {
        const answered = yield* failureResponse({}, Cause.die("boom"));
        const answerBody: unknown = yield* Effect.promise(() => answered.json());
        return { body: answerBody, status: answered.status };
      }),
    ));

  it("is answered with a generic server error", ({ failureAnswer }) => {
    expect(failureAnswer).toStrictEqual({
      body: { error: unexpectedMessage },
      status: httpStatus.internalServerError,
    });
  });
});

describe("a failure only a route table names", () => {
  const it = test.extend("failureAnswer", () =>
    Effect.runPromise(
      Effect.gen(function* failureAnswerProgram() {
        const table = {
          Conflicted: { message: "既に登録されています。", status: httpStatus.conflict },
        };
        const answered = yield* failureResponse(table, Cause.fail({ _tag: "Conflicted" }));
        const answerBody: unknown = yield* Effect.promise(() => answered.json());
        return { body: answerBody, status: answered.status };
      }),
    ));

  it("is answered by the route table", ({ failureAnswer }) => {
    expect(failureAnswer).toStrictEqual({
      body: { error: "既に登録されています。" },
      status: httpStatus.conflict,
    });
  });
});
