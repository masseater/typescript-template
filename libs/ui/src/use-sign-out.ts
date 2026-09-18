import { useAction, type ActionState } from "./action";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";

const useSignOut = (
  destination = "/login",
): Readonly<{ action: ActionState; signOut: () => void }> => {
  const action = useAction();
  const signOut = (): void => {
    action.run(async () => {
      requireSuccess(await authClient.signOut());
      globalThis.location.assign(destination);
    });
  };
  return { action, signOut };
};

export { useSignOut };
