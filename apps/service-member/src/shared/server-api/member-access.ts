import { verifySession } from "@repo/auth";
import { AgreementRequired, requireConsent } from "@repo/db/agreement";
import { httpStatus } from "@repo/observability";
import { Effect } from "effect";

const agreementFailure = (
  error: AgreementRequired,
): { readonly message: string; readonly status: typeof httpStatus.forbidden } => ({
  message:
    error.kind === "privacy"
      ? "プライバシーポリシーへの同意が必要です。"
      : "利用規約への同意が必要です。",
  status: httpStatus.forbidden,
});

const agreementFailures = { AgreementRequired: agreementFailure } as const;

const consentedSession = Effect.fn("consentedSession")(function* consentedSession(headers: Headers) {
  const current = yield* verifySession(headers);
  yield* requireConsent(current.user.id);
  return current;
});

export { agreementFailures, consentedSession };
