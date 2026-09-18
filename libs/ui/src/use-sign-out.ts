import type { ActionState } from "./action";
import { useAction } from "./action";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";

function useSignOut(
  destination = "/login",
): Readonly<{ action: ActionState; signOut: () => void }> {
  const action = useAction();
  function signOut(): void {
    action.run(async () => {
      requireSuccess(await authClient.signOut());
      globalThis.location.assign(destination);
    });
  }
  return { action, signOut };
}

export { useSignOut };
