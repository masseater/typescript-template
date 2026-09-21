import { httpStatus } from "@repo/observability/http-status";
import { ErrorBody, InvitePreview } from "@repo/runtime/contracts";
import { Result, Schema } from "effect";

import { decodeJson, errorMessage } from "./protocol.ts";

const readFailure = async (served: Response): Promise<unknown> => {
  try {
    return await served.json();
  } catch (unreadableFailure) {
    return { error: errorMessage(unreadableFailure) };
  }
};

const inviteFailureOf = async (served: Response, fallback: string): Promise<string> => {
  const decoded = Schema.decodeUnknownResult(ErrorBody)(await readFailure(served));
  return Result.isSuccess(decoded) ? decoded.success.error : fallback;
};

const fetchInvitationResponse = async (endpoint: string, token: string): Promise<Response> => {
  const previewLocation = new URL(endpoint, globalThis.location.origin);
  previewLocation.searchParams.set("token", token);
  return fetch(previewLocation, { cache: "no-store", credentials: "same-origin" });
};

const previewInvitation = async (
  endpoint: string,
  token: string,
): Promise<
  Readonly<{ email: string; status: "open" }> | Readonly<{ message: string; status: "closed" }>
> => {
  const closedMessage =
    "招待が無効か、有効期限が切れています。招待した人に再送を依頼してください。";
  try {
    const served = await fetchInvitationResponse(endpoint, token);
    if (served.status === httpStatus.notFound) {
      return { message: closedMessage, status: "closed" };
    }
    if (!served.ok) {
      return { message: await inviteFailureOf(served, closedMessage), status: "closed" };
    }
    const servedInvite: unknown = await served.json();
    return { email: decodeJson(InvitePreview, servedInvite).email, status: "open" };
  } catch (previewFailure) {
    return { message: errorMessage(previewFailure), status: "closed" };
  }
};

type Invitation = Awaited<ReturnType<typeof previewInvitation>>;

export { inviteFailureOf, previewInvitation };
export type { Invitation };
