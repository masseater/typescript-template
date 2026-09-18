import type { AuthenticatedHandler } from "./authenticated-handler";
import type { ChallengeMode } from "./challenge-form";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";

interface Credentials {
  readonly email: string;
  readonly password: string;
}

interface SignInHandlers {
  readonly onAuthenticated: AuthenticatedHandler;
  readonly onChallenge: (mode: ChallengeMode) => void;
}

async function signIn(credentials: Credentials, handlers: SignInHandlers): Promise<void> {
  const data = requireSuccess(await authClient.signIn.email({ ...credentials }));
  if ("twoFactorRedirect" in data && data.twoFactorRedirect === true) {
    handlers.onChallenge("totp");
    return;
  }
  if (new URLSearchParams(globalThis.location.search).get("recovery") === "setup") {
    globalThis.location.assign("/security?recovery=setup");
    return;
  }
  await handlers.onAuthenticated();
}

export { signIn };
export type { Credentials, SignInHandlers };
