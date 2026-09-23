import { useAtom } from "@effect/atom-react";
import { Effect, Option, type Exit } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

import { localState } from "./local-state";
import { request, resultError } from "./request";
import { STATUS_VARIANT } from "./shared/ui/status-variants.ts";
import { useToast } from "./shared/ui/use-toast";

type ConfirmedChange<Operation> = Readonly<{
  confirming: Operation | undefined;
  handleConfirm: () => void;
  handleOpenChange: (open: boolean) => void;
  pending: boolean;
  propose: (operation: Operation) => void;
}>;

const settleChange = (
  exit: Exit.Exit<string, unknown>,
  settlement: Readonly<{ notify: ReturnType<typeof useToast>; onChanged: () => void }>,
): void => {
  const change = AsyncResult.fromExit(exit);
  if (AsyncResult.isSuccess(change)) {
    settlement.notify(STATUS_VARIANT.success, change.value);
    settlement.onChanged();
    return;
  }
  const failure = resultError(change);
  if (failure !== undefined) {
    settlement.notify(STATUS_VARIANT.failure, failure);
  }
};

const settleAfter = (
  change: () => Promise<Exit.Exit<string, unknown>>,
  settlement: Readonly<{ notify: ReturnType<typeof useToast>; onChanged: () => void }>,
): Effect.Effect<void> =>
  Effect.gen(function* settleConfirmedChange() {
    settleChange(yield* Effect.promise(change), settlement);
  });

const confirmedChange = <Listed extends Readonly<{ id: string }>, Operation>(
  perform: (listed: Listed, operation: Operation) => Promise<string>,
): ((listed: Listed, onChanged: () => void) => ConfirmedChange<Operation>) => {
  const useConfirming = localState(Option.none<Operation>());
  const performChange = ({
    listed,
    operation,
  }: Readonly<{ listed: Listed; operation: Operation }>): Effect.Effect<string, unknown> =>
    request(() => perform(listed, operation));
  const changeAtom = Atom.family((listedId: string) => {
    void listedId;
    return Atom.fn(performChange);
  });
  const useConfirmedChange = (
    listed: Listed,
    onChanged: () => void,
  ): ConfirmedChange<Operation> => {
    const notify = useToast();
    const [confirming, setConfirming] = useConfirming();
    const [changeState, run] = useAtom(changeAtom(listed.id), { mode: "promiseExit" });
    const handleOpenChange = (open: boolean): void => {
      if (!open) {
        setConfirming(Option.none());
      }
    };
    const handleConfirm = (): void => {
      if (Option.isNone(confirming)) {
        return;
      }
      setConfirming(Option.none());
      Effect.runFork(
        settleAfter(() => run({ listed, operation: confirming.value }), { notify, onChanged }),
      );
    };
    const propose = (operation: Operation): void => {
      setConfirming(Option.some(operation));
    };
    return {
      confirming: Option.getOrUndefined(confirming),
      handleConfirm,
      handleOpenChange,
      pending: changeState.waiting,
      propose,
    };
  };
  return useConfirmedChange;
};

export { confirmedChange };
export type { ConfirmedChange };
