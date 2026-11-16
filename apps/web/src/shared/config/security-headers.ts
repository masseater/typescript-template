import { contentSecurityPolicy } from "security-headers";

export const DOCUMENT_CACHE_CONTROL = "no-cache, no-store, must-revalidate";

export const noncePolicy = (nonce: string): string =>
  contentSecurityPolicy({ script: [`'nonce-${nonce}'`], style: [`'nonce-${nonce}'`] });
