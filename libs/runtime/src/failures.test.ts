import { assert, describe, it } from "@effect/vitest";
import { RequestRejected, httpStatus } from "@repo/observability";
import { Cause, Effect } from "effect";

import { failureBy, failureResponse, inputFailures, type AnyFailureTable } from "./failures.ts";
import { InputInvalid } from "./input-invalid.ts";

const invalidInput = "入力内容を確認してください。";
const forbidden = "この操作は許可されていません。";
const sessionFailures = {
  AdminMfaRequired: { message: forbidden, status: httpStatus.forbidden },
  AdminRequired: { message: forbidden, status: httpStatus.forbidden },
  SessionInvalid: { message: forbidden, status: httpStatus.forbidden },
  SessionRequired: { message: "ログインしてください。", status: httpStatus.unauthorized },
};

const answers = [
  {
    error: new InputInvalid(),
    message: invalidInput,
    status: httpStatus.badRequest,
    table: inputFailures.query,
  },
  {
    error: { _tag: "SessionRequired" },
    message: "ログインしてください。",
    status: httpStatus.unauthorized,
    table: sessionFailures,
  },
  {
    error: { _tag: "SessionInvalid" },
    message: forbidden,
    status: httpStatus.forbidden,
    table: sessionFailures,
  },
  {
    error: { _tag: "AdminRequired" },
    message: forbidden,
    status: httpStatus.forbidden,
    table: sessionFailures,
  },
  {
    error: { _tag: "AdminMfaRequired" },
    message: forbidden,
    status: httpStatus.forbidden,
    table: sessionFailures,
  },
  {
    error: new RequestRejected({ reason: "invalid_json" }),
    message: invalidInput,
    status: httpStatus.badRequest,
    table: inputFailures.body,
  },
  {
    error: new RequestRejected({ reason: "body_required" }),
    message: forbidden,
    status: httpStatus.badRequest,
    table: inputFailures.body,
  },
  {
    error: new RequestRejected({ reason: "origin_denied" }),
    message: forbidden,
    status: httpStatus.forbidden,
    table: inputFailures.body,
  },
  {
    error: new RequestRejected({ reason: "json_required" }),
    message: forbidden,
    status: httpStatus.unsupportedMediaType,
    table: inputFailures.body,
  },
  {
    error: new RequestRejected({ reason: "body_too_large" }),
    message: forbidden,
    status: httpStatus.payloadTooLarge,
    table: inputFailures.body,
  },
] as const;

function answer(error: unknown, table: AnyFailureTable): Effect.Effect<readonly [number, unknown]> {
  return Effect.gen(function* program() {
    const response = yield* failureResponse(table, Cause.fail(error));
    const body: unknown = yield* Effect.promise(() => response.json());
    return [response.status, body] as const;
  });
}

describe("failure responses", () => {
  for (const { error, message, status, table } of answers) {
    it.effect(`answers ${error._tag} with ${status}`, () =>
      Effect.gen(function* program() {
        assert.deepStrictEqual(yield* answer(error, table), [status, { error: message }]);
      }),
    );
  }

  it.effect("answers an unknown failure with a generic server error", () =>
    Effect.gen(function* program() {
      assert.deepStrictEqual(yield* answer({ _tag: "Unmapped" }, {}), [
        httpStatus.internalServerError,
        { error: "処理に失敗しました。リクエスト ID でログを確認してください。" },
      ]);
    }),
  );

  it.effect("answers a cause that carries no error with a generic server error", () =>
    Effect.gen(function* program() {
      const response = yield* failureResponse({}, Cause.die("boom"));
      assert.strictEqual(response.status, httpStatus.internalServerError);
    }),
  );

  it.effect("lets a route table answer a failure the common table does not name", () =>
    Effect.gen(function* program() {
      const table = {
        Conflicted: { message: "既に登録されています。", status: httpStatus.conflict },
      };
      const response = yield* failureResponse(table, Cause.fail({ _tag: "Conflicted" }));
      assert.strictEqual(response.status, httpStatus.conflict);
      assert.deepStrictEqual(yield* Effect.promise(() => response.json()), {
        error: "既に登録されています。",
      });
    }),
  );

  it.effect("answers every status a failureBy mapping names", () =>
    Effect.gen(function* program() {
      const table = {
        Throttled: failureBy(
          [httpStatus.tooManyRequests, httpStatus.badRequest],
          (again: { readonly again: boolean }) =>
            again.again
              ? { message: "しばらく待ってください。", status: httpStatus.tooManyRequests }
              : { message: "確認できません。", status: httpStatus.badRequest },
        ),
      };
      assert.deepStrictEqual(yield* answer({ _tag: "Throttled", again: true }, table), [
        httpStatus.tooManyRequests,
        { error: "しばらく待ってください。" },
      ]);
      assert.deepStrictEqual(yield* answer({ _tag: "Throttled", again: false }, table), [
        httpStatus.badRequest,
        { error: "確認できません。" },
      ]);
    }),
  );
});
