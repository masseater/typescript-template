import { Cause, Effect, Option, Schema } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

class RequestFailed extends Schema.TaggedError<RequestFailed>()("RequestFailed", {
  message: Schema.String,
}) {}

type RequestResult<Value> = AsyncResult.AsyncResult<Value, RequestFailed>;

const requestErrorMessage = (failure: unknown): string => {
  return failure instanceof Error
    ? failure.message
    : "操作に失敗しました。もう一度お試しください。";
};

const requestEffect = <Value>(task: () => Promise<Value>): Effect.Effect<Value, RequestFailed> => {
  return Effect.tryPromise({
    catch: (cause) => new RequestFailed({ message: requestErrorMessage(cause) }),
    try: task,
  });
};

const requestAtom = <Value>(task: () => Promise<Value>): Atom.Atom<RequestResult<Value>> => {
  return Atom.make(requestEffect(task)).pipe(Atom.withServerValueInitial);
};

const resultError = (asyncState: object): string | undefined => {
  const settled = asyncState as RequestResult<unknown>;
  if (
    !AsyncResult.isFailure(settled) ||
    settled.waiting ||
    Cause.hasInterruptsOnly(settled.cause)
  ) {
    return undefined;
  }
  return Option.getOrThrowWith(AsyncResult.error(settled), () => Cause.squash(settled.cause))
    .message;
};

export { requestEffect as request, requestAtom, resultError };
export type { RequestResult };
