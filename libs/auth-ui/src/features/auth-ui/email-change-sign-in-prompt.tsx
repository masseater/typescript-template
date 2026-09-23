import { StatusMessage, STATUS_VARIANT } from "@repo/ui";

import { loginPath } from "./login-redirect.ts";

import type { ReactElement } from "react";

const EmailChangeSignInPrompt = (): ReactElement => {
  const currentLocation =
    "location" in globalThis ? `${globalThis.location.pathname}${globalThis.location.hash}` : "/";
  return (
    <>
      <StatusMessage variant={STATUS_VARIANT.info}>
        {"メールアドレスの変更を確定するには、ログインしてからこのリンクをもう一度開いてください。"}
      </StatusMessage>
      <a href={loginPath(currentLocation)}>{"ログイン"}</a>
    </>
  );
};

export { EmailChangeSignInPrompt };
