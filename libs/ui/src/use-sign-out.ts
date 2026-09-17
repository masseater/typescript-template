import type { ActionState } from "./action";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { useAction } from "./action";
import { useCallback } from "react";

function useSignOut(): Readonly<{ action: ActionState; signOut: () => void }> {
  const action = useAction();
  const { run } = action;
  const signOut = useCallback(() => {
    run(async () => {
      requireSuccess(await authClient.signOut());
      globalThis.location.assign("/login");
    });
  }, [run]);
  return { action, signOut };
}

export { useSignOut };
