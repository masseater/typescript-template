import { Cause, Effect, Option, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { errorMessage } from "./protocol";

type Failure = AsyncResult.Failure<unknown, Readonly<{ message: string }>>;

class RequestFailed extends Schema.TaggedError<RequestFailed>()("RequestFailed", {
  message: Schema.String,
}) {}

function request<Value>(task: () => Promise<Value>): Effect.Effect<Value, RequestFailed> {
  return Effect.tryPromise({
    catch: (cause) => new RequestFailed({ message: errorMessage(cause) }),
    try: task,
  });
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function failureMessage(failure: Failure): string {
  return Option.match(AsyncResult.error(failure), {
    onNone: () => errorMessage(Cause.squash(failure.cause)),
    onSome: ({ message }) => message,
  });
}

function resultError(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  result: AsyncResult.AsyncResult<unknown, Readonly<{ message: string }>>,
): string | undefined {
  return AsyncResult.isFailure(result) && !result.waiting ? failureMessage(result) : undefined;
}

export { failureMessage, request, resultError };
