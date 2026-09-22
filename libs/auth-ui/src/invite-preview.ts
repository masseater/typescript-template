import { httpStatus } from "@repo/observability/http-status";
import { ErrorBody, InvitePreview } from "@repo/runtime/contracts";
import { Result, Schema } from "effect";

import { decodeJson, errorMessage } from "./protocol.ts";

const fetchInvitationResponse = (
  fetchImpl: typeof fetch,
  endpoint: string,
  token: string,
): Promise<Response> => {
  const previewLocation = new URL(endpoint, globalThis.location.origin);
  previewLocation.searchParams.set("token", token);
  return fetchImpl(previewLocation, { cache: "no-store", credentials: "same-origin" });
};

type Invitation =
  | Readonly<{ email: string; status: "available" }>
  | Readonly<{ message: string; status: "unavailable" }>;

const unavailable = (message: string): Invitation => ({ message, status: "unavailable" });

const available = (email: string): Invitation => ({ email, status: "available" });

const readFailure = (served: Response): Promise<unknown> =>
  served.json().then(
    (body: unknown): unknown => body,
    (unreadableFailure: unknown) => ({ error: errorMessage(unreadableFailure) }),
  );

const inviteFailureOf = (served: Response, fallback: string): Promise<string> =>
  readFailure(served).then((failureBody) => {
    const decoded = Schema.decodeUnknownResult(ErrorBody)(failureBody);
    return Result.isSuccess(decoded) ? decoded.success.error : fallback;
  });

const readInvitation = (served: Response, closedMessage: string): Promise<Invitation> => {
  if (served.status === httpStatus.notFound) {
    return Promise.resolve(unavailable(closedMessage));
  }
  if (!served.ok) {
    return inviteFailureOf(served, closedMessage).then(unavailable);
  }
  return served
    .json()
    .then((servedInvite: unknown) => available(decodeJson(InvitePreview, servedInvite).email));
};

const previewInvitation = (endpoint: string, token: string): Promise<Invitation> => {
  const closedMessage =
    "招待が無効か、有効期限が切れています。招待した人に再送を依頼してください。";
  return fetchInvitationResponse(fetch, endpoint, token)
    .then((served) => readInvitation(served, closedMessage))
    .catch((previewFailure: unknown) => unavailable(errorMessage(previewFailure)));
};

export { inviteFailureOf, previewInvitation };
export type { Invitation };
