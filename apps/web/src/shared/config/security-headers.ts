import { contentSecurityPolicy } from "security-headers";

const DOCUMENT_CACHE_CONTROL = "no-cache, no-store, must-revalidate";

const noncePolicy = (nonce: string): string =>
  contentSecurityPolicy({ script: [`'nonce-${nonce}'`], style: [`'nonce-${nonce}'`] });

export { DOCUMENT_CACHE_CONTROL, noncePolicy };
