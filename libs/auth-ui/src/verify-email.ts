import { queryOptions } from "@tanstack/react-query";

import { verifyEmailToken } from "./verify-email-token.ts";

const verificationKey = ["auth", "email-verification"] as const;

const emailVerificationOptions = queryOptions({
  gcTime: Infinity,
  queryFn: verifyEmailToken,
  queryKey: verificationKey,
  retry: false,
  staleTime: Infinity,
});

export { emailVerificationOptions };
