import { authClient } from "./client";
import { requireSuccess } from "./protocol";

interface Registration {
  readonly email: string;
  readonly name: string;
  readonly password: string;
}

async function signUp(registration: Registration): Promise<void> {
  requireSuccess(await authClient.signUp.email({ ...registration, callbackURL: "/login" }));
}

export { signUp };
export type { Registration };
