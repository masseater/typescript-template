import { queryOptions } from "@tanstack/react-query";

const verificationKey = ["auth", "email-verification"] as const;

const verificationToken = (): string => {
  return new URLSearchParams(globalThis.location.hash.slice(1)).get("token") ?? "";
};

const verificationEndpoint = "/api/verify-email";

const verifyEmailToken = async (): Promise<boolean> => {
  const token = verificationToken();
  if (token === "") {
    return false;
  }
  const [settled] = await Promise.allSettled([
    fetch(verificationEndpoint, {
      body: JSON.stringify({ token }),
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  ]);
  return settled.status === "fulfilled" && settled.value.ok;
};

const emailVerificationOptions = queryOptions({
  gcTime: Infinity,
  queryFn: verifyEmailToken,
  queryKey: verificationKey,
  retry: false,
  staleTime: Infinity,
});

export { emailVerificationOptions };
