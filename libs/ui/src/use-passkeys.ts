import { serverQuery, useRefresh, useServerQuery } from "./server-query";
import type { PasskeySummary } from "./mfa-types";
import { authClient } from "./client";
import { request } from "./request";
import { requireSuccess } from "./protocol";

interface PasskeysState {
  readonly listError: string | undefined;
  readonly passkeys: readonly PasskeySummary[] | undefined;
  readonly reload: () => void;
}

const passkeysKey = ["passkeys"];

const passkeysQuery = serverQuery(
  passkeysKey,
  request(async () => requireSuccess(await authClient.passkey.listUserPasskeys())),
);

function usePasskeys(): PasskeysState {
  const result = useServerQuery(passkeysQuery);
  const refresh = useRefresh();
  return {
    listError: result.status === "failure" ? result.message : undefined,
    passkeys: result.status === "success" ? result.value : undefined,
    reload: () => {
      refresh(passkeysKey);
    },
  };
}

export { usePasskeys };
