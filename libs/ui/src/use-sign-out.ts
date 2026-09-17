import type { ActionState } from "./action";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { useAction } from "./action";

function useSignOut(): Readonly<{ action: ActionState; signOut: () => void }> {
  const action = useAction();
  function signOut(): void {
    action.run(async () => {
      requireSuccess(await authClient.signOut());
      globalThis.location.assign("/login");
    });
  }
  return { action, signOut };
}

export { useSignOut };
