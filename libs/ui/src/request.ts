import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { Cause, Effect, Option, Schema } from "effect";
import { errorMessage } from "./protocol";

class RequestFailed extends Schema.TaggedError<RequestFailed>()("RequestFailed", {
  message: Schema.String,
}) {}

type RequestResult<Value> = AsyncResult.AsyncResult<Value, RequestFailed>;

function request<Value>(task: () => Promise<Value>): Effect.Effect<Value, RequestFailed> {
  return Effect.tryPromise({
    catch: (cause) => new RequestFailed({ message: errorMessage(cause) }),
    try: task,
  });
}

function requestAtom<Value>(task: () => Promise<Value>): Atom.Atom<RequestResult<Value>> {
  return Atom.make(request(task)).pipe(Atom.withServerValueInitial);
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function resultError(result: RequestResult<unknown>): string | undefined {
  if (!AsyncResult.isFailure(result) || result.waiting || Cause.hasInterruptsOnly(result.cause)) {
    return undefined;
  }
  return Option.getOrThrowWith(AsyncResult.error(result), () => Cause.squash(result.cause)).message;
}

export { request, requestAtom, resultError };
export type { RequestFailed, RequestResult };
