import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect } from "effect";

import { RequestRejected, httpStatus } from "@repo/observability";

import { failureResponse } from "./failures.ts";
import { InputInvalid } from "./input-invalid.ts";

const invalidInput = "入力内容を確認してください。";
const forbidden = "この操作は許可されていません。";

const answers = [
  { error: new InputInvalid(), message: invalidInput, status: httpStatus.badRequest },
  {
    error: { _tag: "SessionRequired" },
    message: "ログインしてください。",
    status: httpStatus.unauthorized,
  },
  { error: { _tag: "SessionInvalid" }, message: forbidden, status: httpStatus.forbidden },
  { error: { _tag: "AdminRequired" }, message: forbidden, status: httpStatus.forbidden },
  { error: { _tag: "AdminMfaRequired" }, message: forbidden, status: httpStatus.forbidden },
  {
    error: new RequestRejected({ reason: "invalid_json" }),
    message: invalidInput,
    status: httpStatus.badRequest,
  },
  {
    error: new RequestRejected({ reason: "body_required" }),
    message: forbidden,
    status: httpStatus.badRequest,
  },
  {
    error: new RequestRejected({ reason: "origin_denied" }),
    message: forbidden,
    status: httpStatus.forbidden,
  },
  {
    error: new RequestRejected({ reason: "json_required" }),
    message: forbidden,
    status: httpStatus.unsupportedMediaType,
  },
  {
    error: new RequestRejected({ reason: "body_too_large" }),
    message: forbidden,
    status: httpStatus.payloadTooLarge,
  },
] as const;

function answer(error: unknown): Effect.Effect<readonly [number, unknown]> {
  return Effect.gen(function* program() {
    const response = yield* failureResponse({}, Cause.fail(error));
    const body: unknown = yield* Effect.promise(async () => response.json());
    return [response.status, body] as const;
  });
}

describe("failure responses", () => {
  for (const { error, message, status } of answers) {
    it.effect(`answers ${error._tag} with ${status}`, () =>
      Effect.gen(function* program() {
        assert.deepStrictEqual(yield* answer(error), [status, { error: message }]);
      }),
    );
  }

  it.effect("answers an unknown failure with a generic server error", () =>
    Effect.gen(function* program() {
      assert.deepStrictEqual(yield* answer({ _tag: "Unmapped" }), [
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
      assert.deepStrictEqual(yield* Effect.promise(async () => response.json()), {
        error: "既に登録されています。",
      });
    }),
  );
});
