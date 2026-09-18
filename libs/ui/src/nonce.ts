import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { cspNonceHeader } from "@repo/config/security";

const requestNonce = createIsomorphicFn()
  .client((): string | undefined => undefined)
  .server((): string | undefined => getRequestHeader(cspNonceHeader));

function nonceOptions(): { readonly ssr?: { readonly nonce: string } } {
  const nonce = requestNonce();
  return nonce === undefined ? {} : { ssr: { nonce } };
}

export { nonceOptions };
