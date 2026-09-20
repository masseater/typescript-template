import { cspNonceHeader } from "@repo/runtime/security";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

const requestNonce = createIsomorphicFn()
  .client((): string | undefined => undefined)
  .server((): string | undefined => getRequestHeader(cspNonceHeader));

const nonceOptions = (): { readonly ssr?: { readonly nonce: string } } => {
  const nonce = requestNonce();
  return nonce === undefined ? {} : { ssr: { nonce } };
};

export { nonceOptions };
