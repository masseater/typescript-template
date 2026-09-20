import { Effect, Ref } from "effect";

const verificationEndpoint = "/api/verify-email";

const pendingVerification = Effect.runSync(
  Ref.make<{ readonly result: Promise<boolean>; readonly token: string } | undefined>(undefined),
);

const verifyEmailToken = async (): Promise<boolean> => {
  const token = new URLSearchParams(globalThis.location.hash.slice(1)).get("token");
  if (token === null || token === "") {
    Effect.runSync(Ref.set(pendingVerification, undefined));
    return false;
  }
  const cached = Effect.runSync(Ref.get(pendingVerification));
  if (cached?.token === token) {
    return cached.result;
  }
  const accepted = (async (): Promise<boolean> => {
    const [settled] = await Promise.allSettled([
      fetch(verificationEndpoint, {
        body: JSON.stringify({ token }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    ]);
    return settled.status === "fulfilled" && settled.value.ok;
  })();
  Effect.runSync(Ref.set(pendingVerification, { result: accepted, token }));
  return accepted;
};

export { verifyEmailToken };
