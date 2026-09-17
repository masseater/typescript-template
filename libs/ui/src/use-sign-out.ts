import type { ActionState } from "./action";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { useAction } from "./action";
import { useCallback } from "react";

interface SignOut {
  readonly action: ActionState;
  readonly signOut: () => void;
}

function useSignOut(destination: string): SignOut {
  const action = useAction();
  const { run } = action;
  const signOut = useCallback(() => {
    run(async () => {
      requireSuccess(await authClient.signOut());
      globalThis.location.assign(destination);
    });
  }, [destination, run]);
  return { action, signOut };
}

export { useSignOut };
