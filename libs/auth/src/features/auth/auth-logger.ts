import { logAt, redactedField } from "@repo/observability";
import { Cause, Result, type Effect } from "effect";

import type { BetterAuthOptions } from "better-auth";

const loggedDetails = (details: readonly unknown[]): { readonly details?: string } => {
  const plain = details.filter((detail) => !(detail instanceof Error));
  if (plain.length === 0) {
    return {};
  }
  const encoded = Result.try(() => JSON.stringify(plain, redactedField));
  return { details: Result.isSuccess(encoded) ? encoded.success : "[unserializable]" };
};

const createLogger = (
  run: (logged: Effect.Effect<void>) => Promise<void>,
): NonNullable<BetterAuthOptions["logger"]> => {
  return {
    level: "warn",
    log: (level, description, ...details: readonly unknown[]) => {
      const failure = details.find((detail) => detail instanceof Error);
      const cause = failure === undefined ? undefined : Cause.fail(failure);
      const attributes = { description, level, ...loggedDetails(details) };
      void run(
        level === "error"
          ? logAt("Error", { attributes, cause, eventName: "authentication.failed" })
          : logAt(level === "warn" ? "Warn" : "Info", {
              attributes,
              cause,
              eventName: "authentication.diagnostic",
            }),
      );
    },
  };
};

export { createLogger };
